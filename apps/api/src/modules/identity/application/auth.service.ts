import { Inject, Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { loadEnvironment } from '@pratto/config';
import type { AuthContextResponse, EmailService } from '@pratto/contracts';
import { EMAIL_SERVICE } from '@pratto/contracts';
import { prisma } from '@pratto/database';
import { PinoLogger } from 'nestjs-pino';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import {
  PASSWORD_RESET_TTL_MS,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
} from '../domain/auth.constants';
import { createOpaqueToken, keyedHash } from '../domain/auth.crypto';
import type { AuthenticatedPrincipal, TenantPrincipal } from '../domain/auth.types';
import {
  isSessionExpired,
  renewedSessionExpiration,
  shouldRenewSession,
} from '../domain/session-policy';

import { PasswordService } from './password.service';
import { RateLimitService } from './rate-limit.service';

type EventInput = {
  eventType: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  userId?: string;
  sessionId?: string;
  organizationId?: string;
  subject?: string;
};

@Injectable()
export class AuthService {
  private readonly environment = loadEnvironment();

  constructor(
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(RateLimitService) private readonly rateLimits: RateLimitService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
    @Inject(EMAIL_SERVICE) private readonly email: EmailService,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async login(
    input: { email: string; password: string },
    ipAddress: string,
  ): Promise<{ token: string; expiresAt: Date; context: AuthContextResponse; sessionId: string }> {
    try {
      await Promise.all([
        this.rateLimits.consume('login:email', input.email, 5, 15 * 60 * 1000),
        this.rateLimits.consume('login:ip', ipAddress, 30, 15 * 60 * 1000),
      ]);
    } catch (error) {
      await this.audit({ eventType: 'LOGIN', outcome: 'BLOCKED', subject: input.email });
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        credential: true,
        memberships: {
          where: { status: 'ACTIVE', organization: { status: 'ACTIVE' } },
          select: { id: true },
        },
      },
    });
    const validPassword = await this.passwords.verify(
      user?.credential?.passwordHash,
      input.password,
    );
    if (!user || user.status !== 'ACTIVE' || !user.credential || !validPassword) {
      await this.audit({
        eventType: 'LOGIN',
        outcome: 'FAILURE',
        userId: user?.id,
        subject: input.email,
      });
      throw new StableHttpException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'E-mail ou senha inválidos.',
      );
    }

    const now = new Date();
    const token = createOpaqueToken();
    const expiresAt = new Date(now.getTime() + SESSION_IDLE_TTL_MS);
    const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);
    const activeMembershipId = user.memberships.length === 1 ? user.memberships[0]?.id : undefined;
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: keyedHash(this.environment.COOKIE_SECRET, 'session', token),
        expiresAt,
        absoluteExpiresAt,
        lastSeenAt: now,
        activeMembershipId,
        createdAt: now,
      },
    });
    const context = await this.getContext({
      sessionId: session.id,
      userId: user.id,
      rawToken: token,
      expiresAt,
      renewed: false,
    });
    await this.audit({
      eventType: 'LOGIN',
      outcome: 'SUCCESS',
      userId: user.id,
      sessionId: session.id,
    });
    return { token, expiresAt, context, sessionId: session.id };
  }

  async authenticate(token: string | undefined): Promise<AuthenticatedPrincipal> {
    if (!token) this.authenticationRequired();
    const tokenHash = keyedHash(this.environment.COOKIE_SECRET, 'session', token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { select: { status: true } } },
    });
    if (!session) this.authenticationRequired();
    if (session.revokedAt) {
      throw new StableHttpException(
        HttpStatus.UNAUTHORIZED,
        'SESSION_REVOKED',
        'A sessão foi revogada.',
      );
    }
    const now = new Date();
    if (isSessionExpired(session.expiresAt, session.absoluteExpiresAt, now)) {
      throw new StableHttpException(
        HttpStatus.UNAUTHORIZED,
        'SESSION_EXPIRED',
        'A sessão expirou.',
      );
    }
    if (session.user.status !== 'ACTIVE') this.authenticationRequired();

    const activityReference = session.lastSeenAt ?? session.createdAt;
    const shouldRenew = shouldRenewSession(activityReference, now);
    let expiresAt = session.expiresAt;
    if (shouldRenew) {
      expiresAt = renewedSessionExpiration(now, session.absoluteExpiresAt);
      await prisma.session.update({
        where: { id: session.id },
        data: { expiresAt, lastSeenAt: now },
      });
    }
    return {
      sessionId: session.id,
      userId: session.userId,
      rawToken: token,
      expiresAt,
      renewed: shouldRenew,
    };
  }

  async getContext(principal: AuthenticatedPrincipal): Promise<AuthContextResponse> {
    const [user, session] = await Promise.all([
      prisma.user.findFirstOrThrow({
        where: { id: principal.userId, status: 'ACTIVE' },
        select: {
          id: true,
          email: true,
          name: true,
          memberships: {
            where: { status: 'ACTIVE', organization: { status: 'ACTIVE' } },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              role: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  establishments: {
                    where: { status: 'ACTIVE' },
                    orderBy: { name: 'asc' },
                    select: { id: true, publicId: true, name: true, slug: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.session.findUniqueOrThrow({
        where: { id: principal.sessionId },
        select: { activeMembershipId: true },
      }),
    ]);
    const available = user.memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      membershipId: membership.id,
      role: membership.role,
    }));
    let selected = user.memberships.find(({ id }) => id === session.activeMembershipId);
    if (!selected && user.memberships.length === 1) {
      selected = user.memberships[0];
      await prisma.session.update({
        where: { id: principal.sessionId },
        data: { activeMembershipId: selected?.id },
      });
    } else if (!selected && session.activeMembershipId) {
      await prisma.session.update({
        where: { id: principal.sessionId },
        data: { activeMembershipId: null },
      });
    }

    return {
      user: { id: user.id, email: user.email, name: user.name },
      activeOrganization: selected
        ? {
            id: selected.organization.id,
            name: selected.organization.name,
            membershipId: selected.id,
            role: selected.role,
          }
        : null,
      organizations: available,
      establishments: selected?.organization.establishments ?? [],
      organizationSelectionRequired: !selected && available.length > 1,
    };
  }

  async selectOrganization(
    principal: AuthenticatedPrincipal,
    membershipId: string,
  ): Promise<AuthContextResponse> {
    const membership = await prisma.membership.findFirst({
      where: {
        id: membershipId,
        userId: principal.userId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      select: { id: true, organizationId: true },
    });
    if (!membership) {
      await this.audit({
        eventType: 'ORGANIZATION_SELECTION',
        outcome: 'FAILURE',
        userId: principal.userId,
        sessionId: principal.sessionId,
      });
      throw new StableHttpException(
        HttpStatus.FORBIDDEN,
        'ORGANIZATION_ACCESS_DENIED',
        'A organização não está disponível para este usuário.',
      );
    }
    await prisma.session.update({
      where: { id: principal.sessionId },
      data: { activeMembershipId: membership.id },
    });
    await this.audit({
      eventType: 'ORGANIZATION_SELECTION',
      outcome: 'SUCCESS',
      userId: principal.userId,
      sessionId: principal.sessionId,
      organizationId: membership.organizationId,
    });
    return this.getContext(principal);
  }

  async resolveTenantPrincipal(principal: AuthenticatedPrincipal): Promise<TenantPrincipal> {
    const session = await prisma.session.findUniqueOrThrow({
      where: { id: principal.sessionId },
      select: { activeMembershipId: true },
    });
    if (!session.activeMembershipId) {
      throw new StableHttpException(
        HttpStatus.CONFLICT,
        'ORGANIZATION_SELECTION_REQUIRED',
        'Selecione uma organização para continuar.',
      );
    }
    const membership = await prisma.membership.findFirst({
      where: {
        id: session.activeMembershipId,
        userId: principal.userId,
        status: 'ACTIVE',
        user: { status: 'ACTIVE' },
        organization: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        organizationId: true,
        role: true,
        organization: {
          select: { establishments: { where: { status: 'ACTIVE' }, select: { id: true } } },
        },
      },
    });
    if (!membership) {
      await prisma.session.update({
        where: { id: principal.sessionId },
        data: { activeMembershipId: null },
      });
      throw new StableHttpException(
        HttpStatus.FORBIDDEN,
        'ORGANIZATION_ACCESS_DENIED',
        'O acesso à organização selecionada não está mais ativo.',
      );
    }
    return {
      ...principal,
      membershipId: membership.id,
      organizationId: membership.organizationId,
      role: membership.role,
      establishmentIds: membership.organization.establishments.map(({ id }) => id),
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    const tokenHash = keyedHash(this.environment.COOKIE_SECRET, 'session', token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true },
    });
    if (!session) return;
    await prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit({
      eventType: 'LOGOUT',
      outcome: 'SUCCESS',
      userId: session.userId,
      sessionId: session.id,
    });
  }

  async logoutAll(principal: AuthenticatedPrincipal): Promise<void> {
    await prisma.$transaction([
      prisma.session.updateMany({
        where: { userId: principal.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.authenticationEvent.create({
        data: {
          eventType: 'LOGOUT_ALL',
          outcome: 'SUCCESS',
          userId: principal.userId,
          sessionId: principal.sessionId,
        },
      }),
    ]);
  }

  async forgotPassword(email: string, ipAddress: string): Promise<void> {
    try {
      await Promise.all([
        this.rateLimits.consume('forgot-password:email', email, 3, 60 * 60 * 1000),
        this.rateLimits.consume('forgot-password:ip', ipAddress, 20, 60 * 60 * 1000),
      ]);
    } catch (error) {
      await this.audit({ eventType: 'PASSWORD_RESET_REQUEST', outcome: 'BLOCKED', subject: email });
      throw error;
    }
    const user = await prisma.user.findFirst({
      where: { email, status: 'ACTIVE', credential: { isNot: null } },
      select: { id: true, email: true },
    });
    if (!user) {
      await this.audit({ eventType: 'PASSWORD_RESET_REQUEST', outcome: 'SUCCESS', subject: email });
      return;
    }
    const token = createOpaqueToken();
    const tokenHash = keyedHash(this.environment.COOKIE_SECRET, 'password-reset', token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      create: { userId: user.id, tokenHash, expiresAt },
      update: { tokenHash, expiresAt, usedAt: null, createdAt: new Date() },
    });
    const resetUrl = `${this.environment.WEB_URL}/reset-password#token=${encodeURIComponent(token)}`;
    await this.email.send({
      to: user.email,
      subject: 'Redefina sua senha no Pratto',
      text: `Abra este endereço para redefinir sua senha: ${resetUrl}\nO link expira em 30 minutos.`,
    });
    await this.audit({
      eventType: 'PASSWORD_RESET_REQUEST',
      outcome: 'SUCCESS',
      userId: user.id,
      subject: email,
    });
  }

  async resetPassword(token: string, password: string, ipAddress: string): Promise<void> {
    try {
      await Promise.all([
        this.rateLimits.consume('reset-password:token', token, 5, 15 * 60 * 1000),
        this.rateLimits.consume('reset-password:ip', ipAddress, 30, 15 * 60 * 1000),
      ]);
    } catch (error) {
      await this.audit({ eventType: 'PASSWORD_RESET', outcome: 'BLOCKED', subject: token });
      throw error;
    }
    const tokenHash = keyedHash(this.environment.COOKIE_SECRET, 'password-reset', token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt) this.invalidResetToken();
    if (record.expiresAt <= new Date()) {
      throw new StableHttpException(
        HttpStatus.BAD_REQUEST,
        'PASSWORD_RESET_TOKEN_EXPIRED',
        'O link de redefinição expirou.',
      );
    }
    const passwordHash = await this.passwords.hash(password);
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) this.invalidResetToken();
      await transaction.passwordCredential.upsert({
        where: { userId: record.userId },
        create: { userId: record.userId, passwordHash, passwordChangedAt: now, createdAt: now },
        update: { passwordHash, passwordChangedAt: now },
      });
      await transaction.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.authenticationEvent.create({
        data: { eventType: 'PASSWORD_RESET', outcome: 'SUCCESS', userId: record.userId },
      });
    });
    this.logger.info(
      { userId: record.userId, eventType: 'PASSWORD_RESET' },
      'Authentication event',
    );
  }

  private authenticationRequired(): never {
    throw new StableHttpException(
      HttpStatus.UNAUTHORIZED,
      'AUTHENTICATION_REQUIRED',
      'Autenticação obrigatória.',
    );
  }

  private invalidResetToken(): never {
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'PASSWORD_RESET_TOKEN_INVALID',
      'O link de redefinição é inválido.',
    );
  }

  private async audit(input: EventInput): Promise<void> {
    const subjectHash = input.subject
      ? keyedHash(this.environment.COOKIE_SECRET, 'rate-limit', input.subject)
      : undefined;
    this.logger.info(
      {
        eventType: input.eventType,
        outcome: input.outcome,
        userId: input.userId,
        sessionId: input.sessionId,
        organizationId: input.organizationId,
        subjectHash,
      },
      'Authentication event',
    );
    try {
      await prisma.authenticationEvent.create({
        data: {
          eventType: input.eventType,
          outcome: input.outcome,
          userId: input.userId,
          sessionId: input.sessionId,
          organizationId: input.organizationId,
          subjectHash,
        },
      });
    } catch (error) {
      this.logger.warn(
        { err: error, eventType: input.eventType },
        'Could not persist authentication event',
      );
    }
  }
}
