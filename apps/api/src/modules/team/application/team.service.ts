import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { loadEnvironment } from '@pratto/config';
import {
  canManageRole,
  assignableRoles,
  EMAIL_SERVICE,
  hasPermission,
  Permission,
  type EmailService,
  type InvitationAcceptanceResponse,
  type InvitationPreviewResponse,
  type MembershipRole,
  type TeamInvitation,
  type TeamInvitationStatus,
  type TeamMember,
  type TeamResponse,
} from '@pratto/contracts';
import { Prisma, prisma } from '@pratto/database';
import {
  type InvitationAcceptInput,
  type TeamInviteInput,
  type TeamRoleUpdateInput,
} from '@pratto/validation';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import { PasswordService } from '../../identity/application/password.service';
import { createOpaqueToken, keyedHash } from '../../identity/domain/auth.crypto';
import type { TenantPrincipal } from '../../identity/domain/auth.types';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type TeamMembership = Prisma.MembershipGetPayload<{
  select: {
    id: true;
    userId: true;
    role: true;
    status: true;
    createdAt: true;
    updatedAt: true;
    user: { select: { name: true; email: true } };
  };
}>;

type InvitationRecord = Prisma.MembershipInvitationGetPayload<{
  select: {
    id: true;
    establishmentId: true;
    email: true;
    role: true;
    status: true;
    expiresAt: true;
    acceptedAt: true;
    canceledAt: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

const memberSelect = {
  id: true,
  userId: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { name: true, email: true } },
} satisfies Prisma.MembershipSelect;

const invitationSelect = {
  id: true,
  establishmentId: true,
  email: true,
  role: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  canceledAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MembershipInvitationSelect;

@Injectable()
export class TeamService {
  private readonly environment = loadEnvironment();

  constructor(
    @Inject(EMAIL_SERVICE) private readonly email: EmailService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
  ) {}

  async getTeam(tenant: TenantPrincipal, establishmentId: string): Promise<TeamResponse> {
    await this.findEstablishment(tenant, establishmentId);
    const [members, invitations] = await Promise.all([
      prisma.membership.findMany({
        where: {
          organizationId: tenant.organizationId,
          status: 'ACTIVE',
          user: { status: 'ACTIVE' },
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: memberSelect,
      }),
      prisma.membershipInvitation.findMany({
        where: { organizationId: tenant.organizationId, establishmentId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: invitationSelect,
      }),
    ]);

    return {
      establishmentId,
      members: members.map((member) => this.toMember(member)),
      invitations: invitations.map((invitation) => this.toInvitation(invitation)),
    };
  }

  async invite(
    tenant: TenantPrincipal,
    establishmentId: string,
    input: TeamInviteInput,
  ): Promise<TeamInvitation> {
    this.assertPermission(tenant, Permission.TEAM_INVITE);
    const establishment = await this.findEstablishment(tenant, establishmentId);
    this.assertAssignableRole(tenant.role, input.role);

    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        memberships: {
          where: { organizationId: tenant.organizationId },
          select: { status: true },
        },
      },
    });
    if (existingUser?.memberships.some((membership) => membership.status === 'ACTIVE')) {
      throw new StableHttpException(
        HttpStatus.CONFLICT,
        'MEMBERSHIP_ALREADY_EXISTS',
        'Este usuário já pertence ao estabelecimento.',
      );
    }

    const pending = await prisma.membershipInvitation.findFirst({
      where: { organizationId: tenant.organizationId, email: input.email, status: 'PENDING' },
      select: invitationSelect,
    });
    if (pending && pending.establishmentId !== establishment.id) {
      throw new StableHttpException(
        HttpStatus.CONFLICT,
        'INVITATION_ALREADY_PENDING',
        'Já existe um convite pendente para este e-mail.',
      );
    }

    const token = createOpaqueToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
    let invitation: InvitationRecord;
    try {
      invitation = pending
        ? await prisma.membershipInvitation.update({
            where: { id: pending.id },
            data: {
              role: input.role,
              tokenHash: this.hashInvitationToken(token),
              expiresAt,
              acceptedAt: null,
              canceledAt: null,
              status: 'PENDING',
            },
            select: invitationSelect,
          })
        : await prisma.membershipInvitation.create({
            data: {
              organizationId: tenant.organizationId,
              establishmentId: establishment.id,
              invitedByUserId: tenant.userId,
              email: input.email,
              role: input.role,
              tokenHash: this.hashInvitationToken(token),
              expiresAt,
            },
            select: invitationSelect,
          });
    } catch (error) {
      this.handlePersistenceError(error);
    }

    await this.sendInvitationEmail(input.email, establishment.name, input.role, token);
    return this.toInvitation(invitation);
  }

  async resend(
    tenant: TenantPrincipal,
    establishmentId: string,
    invitationId: string,
  ): Promise<TeamInvitation> {
    this.assertPermission(tenant, Permission.TEAM_INVITE);
    const establishment = await this.findEstablishment(tenant, establishmentId);
    const current = await prisma.membershipInvitation.findFirst({
      where: { id: invitationId, organizationId: tenant.organizationId, establishmentId },
      select: { ...invitationSelect, status: true, email: true, role: true },
    });
    if (!current) this.invitationNotFound();
    if (current.status !== 'PENDING') {
      throw new StableHttpException(
        HttpStatus.CONFLICT,
        'INVITATION_NOT_PENDING',
        'Somente convites pendentes podem ser reenviados.',
      );
    }
    const token = createOpaqueToken();
    const updated = await prisma.membershipInvitation.update({
      where: { id: current.id },
      data: {
        tokenHash: this.hashInvitationToken(token),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
      select: invitationSelect,
    });
    await this.sendInvitationEmail(current.email, establishment.name, current.role, token);
    return this.toInvitation(updated);
  }

  async cancel(
    tenant: TenantPrincipal,
    establishmentId: string,
    invitationId: string,
  ): Promise<void> {
    this.assertPermission(tenant, Permission.TEAM_INVITE);
    await this.findEstablishment(tenant, establishmentId);
    const canceled = await prisma.membershipInvitation.updateMany({
      where: {
        id: invitationId,
        organizationId: tenant.organizationId,
        establishmentId,
        status: 'PENDING',
      },
      data: { status: 'CANCELED', canceledAt: new Date() },
    });
    if (canceled.count !== 1) this.invitationNotFound();
  }

  async updateMember(
    tenant: TenantPrincipal,
    establishmentId: string,
    membershipId: string,
    input: TeamRoleUpdateInput,
  ): Promise<TeamMember> {
    this.assertPermission(tenant, Permission.TEAM_MANAGE);
    await this.findEstablishment(tenant, establishmentId);
    const current = await this.findMember(tenant, membershipId);
    if (current.userId === tenant.userId) this.selfManagementNotAllowed();
    this.assertCanManageTarget(tenant.role, current.role, input.role);
    if (current.role === 'OWNER' && input.role !== 'OWNER') {
      await this.assertAnotherOwner(tenant.organizationId, current.userId);
    }

    const updated = await prisma.membership.update({
      where: { id: current.id },
      data: { role: input.role },
      select: memberSelect,
    });
    return this.toMember(updated);
  }

  async removeMember(
    tenant: TenantPrincipal,
    establishmentId: string,
    membershipId: string,
  ): Promise<void> {
    this.assertPermission(tenant, Permission.TEAM_MANAGE);
    await this.findEstablishment(tenant, establishmentId);
    const current = await this.findMember(tenant, membershipId);
    if (current.userId === tenant.userId) this.selfManagementNotAllowed();
    this.assertCanManageTarget(tenant.role, current.role);
    if (current.role === 'OWNER') {
      await this.assertAnotherOwner(tenant.organizationId, current.userId);
    }
    await prisma.membership.update({ where: { id: current.id }, data: { status: 'INACTIVE' } });
  }

  async preview(token: string): Promise<InvitationPreviewResponse> {
    const invitation = await prisma.membershipInvitation.findUnique({
      where: { tokenHash: this.hashInvitationToken(token) },
      select: {
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        establishment: { select: { name: true } },
      },
    });
    this.assertInvitationUsable(invitation);
    const user = await prisma.user.findUnique({
      where: { email: invitation.email },
      select: { credential: { select: { userId: true } } },
    });
    return {
      email: invitation.email,
      role: invitation.role,
      establishmentName: invitation.establishment.name,
      expiresAt: invitation.expiresAt.toISOString(),
      accountExists: Boolean(user?.credential),
    };
  }

  async accept(input: InvitationAcceptInput): Promise<InvitationAcceptanceResponse> {
    const result = await prisma.$transaction(async (transaction) => {
      const invitation = await transaction.membershipInvitation.findUnique({
        where: { tokenHash: this.hashInvitationToken(input.token) },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          expiresAt: true,
          establishmentId: true,
          organizationId: true,
        },
      });
      this.assertInvitationUsable(invitation);
      const now = new Date();
      let user = await transaction.user.findUnique({
        where: { email: invitation.email },
        select: { id: true, status: true, credential: { select: { userId: true } } },
      });
      let createdAccount = false;
      if (!user) {
        if (!input.name || !input.password) this.accountDetailsRequired();
        const passwordHash = await this.passwords.hash(input.password);
        user = await transaction.user.create({
          data: {
            email: invitation.email,
            name: input.name,
            status: 'ACTIVE',
            credential: { create: { passwordHash } },
          },
          select: { id: true, status: true, credential: { select: { userId: true } } },
        });
        createdAccount = true;
      } else {
        if (user.status !== 'ACTIVE') this.invitationInvalid();
        if (!user.credential) {
          if (!input.password) this.accountDetailsRequired();
          await transaction.passwordCredential.create({
            data: { userId: user.id, passwordHash: await this.passwords.hash(input.password) },
          });
        }
      }

      const existingMembership = await transaction.membership.findUnique({
        where: {
          organizationId_userId: { organizationId: invitation.organizationId, userId: user.id },
        },
        select: { id: true, status: true },
      });
      if (existingMembership?.status === 'ACTIVE') this.membershipAlreadyExists();
      if (existingMembership) {
        await transaction.membership.update({
          where: { id: existingMembership.id },
          data: { role: invitation.role, status: 'ACTIVE' },
        });
      } else {
        await transaction.membership.create({
          data: {
            organizationId: invitation.organizationId,
            userId: user.id,
            role: invitation.role,
            status: 'ACTIVE',
          },
        });
      }

      const accepted = await transaction.membershipInvitation.updateMany({
        where: { id: invitation.id, status: 'PENDING', expiresAt: { gt: now } },
        data: { status: 'ACCEPTED', acceptedAt: now, acceptedUserId: user.id },
      });
      if (accepted.count !== 1) this.invitationInvalid();
      return { email: invitation.email, createdAccount };
    });

    return { ...result, requiresLogin: true };
  }

  private async findEstablishment(tenant: TenantPrincipal, establishmentId: string) {
    if (!tenant.establishmentIds.includes(establishmentId)) this.establishmentNotFound();
    const establishment = await prisma.establishment.findFirst({
      where: { id: establishmentId, organizationId: tenant.organizationId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });
    if (!establishment) this.establishmentNotFound();
    return establishment;
  }

  private async findMember(tenant: TenantPrincipal, membershipId: string): Promise<TeamMembership> {
    const member = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId: tenant.organizationId, status: 'ACTIVE' },
      select: memberSelect,
    });
    if (!member) this.memberNotFound();
    return member;
  }

  private async assertAnotherOwner(organizationId: string, userId: string): Promise<void> {
    const owners = await prisma.membership.count({
      where: { organizationId, role: 'OWNER', status: 'ACTIVE', userId: { not: userId } },
    });
    if (owners === 0) {
      throw new StableHttpException(
        HttpStatus.CONFLICT,
        'LAST_OWNER_REQUIRED',
        'O estabelecimento precisa manter pelo menos um proprietário ativo.',
      );
    }
  }

  private assertPermission(tenant: TenantPrincipal, permission: Permission): void {
    if (hasPermission(tenant.role, permission)) return;
    throw new StableHttpException(
      HttpStatus.FORBIDDEN,
      'PERMISSION_DENIED',
      'Seu perfil não possui permissão para esta operação.',
      { permission },
    );
  }

  private assertAssignableRole(actorRole: MembershipRole, role: MembershipRole): void {
    if (assignableRoles(actorRole).includes(role)) return;
    throw new StableHttpException(
      HttpStatus.FORBIDDEN,
      'ROLE_ASSIGNMENT_DENIED',
      'Seu perfil não pode atribuir este papel.',
    );
  }

  private assertCanManageTarget(
    actorRole: MembershipRole,
    targetRole: MembershipRole,
    nextRole?: MembershipRole,
  ): void {
    if (canManageRole(actorRole, targetRole, nextRole)) return;
    throw new StableHttpException(
      HttpStatus.FORBIDDEN,
      'TEAM_MEMBER_MANAGEMENT_DENIED',
      'Seu perfil não pode alterar este membro.',
    );
  }

  private assertInvitationUsable(
    invitation: {
      status: string;
      expiresAt: Date;
    } | null,
  ): asserts invitation is { status: 'PENDING'; expiresAt: Date } {
    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt <= new Date()) {
      this.invitationInvalid();
    }
  }

  private async sendInvitationEmail(
    email: string,
    establishmentName: string,
    role: MembershipRole,
    token: string,
  ): Promise<void> {
    const url = `${this.environment.WEB_URL}/invitations/accept#token=${encodeURIComponent(token)}`;
    await this.email.send({
      to: email,
      subject: `Convite para colaborar em ${establishmentName} no Pratto`,
      text: `Você foi convidado para colaborar em ${establishmentName} com o papel ${role}. Abra este endereço para aceitar o convite: ${url}\nO link expira em 7 dias.`,
    });
  }

  private hashInvitationToken(token: string): string {
    return keyedHash(this.environment.COOKIE_SECRET, 'invitation', token);
  }

  private toMember(member: TeamMembership): TeamMember {
    return {
      id: member.id,
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      role: member.role as MembershipRole,
      status: member.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };
  }

  private toInvitation(invitation: InvitationRecord): TeamInvitation {
    const status: TeamInvitationStatus =
      invitation.status === 'PENDING' && invitation.expiresAt <= new Date()
        ? 'EXPIRED'
        : (invitation.status as TeamInvitationStatus);
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role as MembershipRole,
      status,
      establishmentId: invitation.establishmentId,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      canceledAt: invitation.canceledAt?.toISOString() ?? null,
      createdAt: invitation.createdAt.toISOString(),
      updatedAt: invitation.updatedAt.toISOString(),
    };
  }

  private invitationNotFound(): never {
    throw new StableHttpException(
      HttpStatus.NOT_FOUND,
      'INVITATION_NOT_FOUND',
      'Convite não encontrado.',
    );
  }

  private invitationInvalid(): never {
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'INVITATION_INVALID',
      'O convite é inválido ou expirou.',
    );
  }

  private membershipAlreadyExists(): never {
    throw new StableHttpException(
      HttpStatus.CONFLICT,
      'MEMBERSHIP_ALREADY_EXISTS',
      'Este usuário já pertence ao estabelecimento.',
    );
  }

  private accountDetailsRequired(): never {
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'ACCOUNT_DETAILS_REQUIRED',
      'Informe nome e senha para criar o acesso.',
    );
  }

  private selfManagementNotAllowed(): never {
    throw new StableHttpException(
      HttpStatus.CONFLICT,
      'SELF_MANAGEMENT_NOT_ALLOWED',
      'Você não pode remover ou alterar o próprio acesso.',
    );
  }

  private memberNotFound(): never {
    throw new StableHttpException(
      HttpStatus.NOT_FOUND,
      'MEMBER_NOT_FOUND',
      'Membro não encontrado.',
    );
  }

  private establishmentNotFound(): never {
    throw new StableHttpException(
      HttpStatus.NOT_FOUND,
      'ESTABLISHMENT_NOT_FOUND',
      'Estabelecimento não encontrado.',
    );
  }

  private handlePersistenceError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new StableHttpException(
        HttpStatus.CONFLICT,
        'INVITATION_CONFLICT',
        'Já existe um convite pendente para este e-mail.',
      );
    }
    throw error;
  }
}
