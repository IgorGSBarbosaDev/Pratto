import type { MembershipRole } from '@pratto/contracts';
import { PrismaClient } from '@prisma/client';

import type { TenantPrincipal } from '../../../../apps/api/src/modules/identity/domain/auth.types';
import { TeamService } from '../../../../apps/api/src/modules/team/application/team.service';
import {
  clearDatabase,
  createMembership,
  createTenantFixture,
  createUser,
} from '../../src/testing';

const database = new PrismaClient();

function tenantContext(
  tenant: Awaited<ReturnType<typeof createTenantFixture>>,
  userId = tenant.user.id,
  membershipId = tenant.membership.id,
  role: MembershipRole = 'OWNER',
): TenantPrincipal {
  return {
    sessionId: 'session-id',
    userId,
    rawToken: 'raw-token',
    expiresAt: new Date(Date.now() + 60_000),
    renewed: false,
    membershipId,
    organizationId: tenant.organization.id,
    role,
    establishmentIds: [tenant.establishment.id],
  };
}

describe('team authorization and invitation integration', () => {
  const send = jest.fn();
  const service = new TeamService({ send, health: jest.fn() }, {
    hash: jest.fn(async () => 'integration-password-hash'),
  } as never);

  beforeEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  function invitationToken(): string {
    const message = send.mock.calls.at(-1)?.[0] as { text?: string } | undefined;
    const match = message?.text?.match(/#token=([^\s]+)/);
    if (!match?.[1]) throw new Error('Invitation token was not sent.');
    return decodeURIComponent(match[1]);
  }

  it('uses a 32-byte opaque token and derives membership role only from the invitation', async () => {
    const tenant = await createTenantFixture(database, { label: 'Secure invitation' });
    await service.invite(tenantContext(tenant), tenant.establishment.id, {
      email: 'invited@example.test',
      role: 'MEMBER',
    });
    const token = invitationToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await service.accept({
      token,
      name: 'Invited User',
      password: 'correct horse battery staple',
      role: 'OWNER',
    } as never);

    const user = await database.user.findUniqueOrThrow({
      where: { email: 'invited@example.test' },
    });
    await expect(
      database.membership.findUniqueOrThrow({
        where: {
          organizationId_userId: {
            organizationId: tenant.organization.id,
            userId: user.id,
          },
        },
      }),
    ).resolves.toMatchObject({ role: 'MEMBER', status: 'ACTIVE' });
    await expect(service.accept({ token })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITATION_INVALID' }),
    });
  });

  it('rejects expired and canceled invitations without creating a membership', async () => {
    const tenant = await createTenantFixture(database, { label: 'Invalid invitation' });
    const expired = await service.invite(tenantContext(tenant), tenant.establishment.id, {
      email: 'expired@example.test',
      role: 'MEMBER',
    });
    const expiredToken = invitationToken();
    await database.membershipInvitation.update({
      where: { id: expired.id },
      data: {
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    await expect(
      service.accept({
        token: expiredToken,
        name: 'Expired User',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITATION_INVALID' }),
    });

    const canceled = await service.invite(tenantContext(tenant), tenant.establishment.id, {
      email: 'canceled@example.test',
      role: 'MEMBER',
    });
    const canceledToken = invitationToken();
    await service.cancel(tenantContext(tenant), tenant.establishment.id, canceled.id);
    await expect(
      service.accept({
        token: canceledToken,
        name: 'Canceled User',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITATION_INVALID' }),
    });

    await service.invite(tenantContext(tenant), tenant.establishment.id, {
      email: 'suspended@example.test',
      role: 'MEMBER',
    });
    const suspendedToken = invitationToken();
    await database.establishment.update({
      where: { id: tenant.establishment.id },
      data: { status: 'INACTIVE' },
    });
    await expect(
      service.accept({
        token: suspendedToken,
        name: 'Suspended User',
        password: 'correct horse battery staple',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITATION_INVALID' }),
    });
    await expect(
      database.membership.count({
        where: {
          organizationId: tenant.organization.id,
          user: {
            email: {
              in: ['expired@example.test', 'canceled@example.test', 'suspended@example.test'],
            },
          },
        },
      }),
    ).resolves.toBe(0);
  });

  it('prevents ADMIN ownership changes and invitation manipulation across establishments', async () => {
    const tenantA = await createTenantFixture(database, { label: 'Authorization A' });
    const tenantB = await createTenantFixture(database, { label: 'Authorization B' });
    const adminUser = await createUser(database, { email: 'admin@example.test' });
    const adminMembership = await createMembership(database, {
      organizationId: tenantA.organization.id,
      userId: adminUser.id,
      role: 'ADMIN',
    });
    const admin = tenantContext(tenantA, adminUser.id, adminMembership.id, 'ADMIN');

    await expect(
      service.invite(admin, tenantA.establishment.id, {
        email: 'unauthorized-owner@example.test',
        role: 'OWNER',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ROLE_ASSIGNMENT_DENIED' }),
    });

    const ownerInvitation = await service.invite(tenantContext(tenantA), tenantA.establishment.id, {
      email: 'future-owner@example.test',
      role: 'OWNER',
    });
    await expect(
      service.cancel(admin, tenantA.establishment.id, ownerInvitation.id),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TEAM_MEMBER_MANAGEMENT_DENIED' }),
    });

    const foreignInvitation = await service.invite(
      tenantContext(tenantB),
      tenantB.establishment.id,
      { email: 'foreign@example.test', role: 'MEMBER' },
    );
    await expect(
      service.cancel(tenantContext(tenantA), tenantA.establishment.id, foreignInvitation.id),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITATION_NOT_FOUND' }),
    });
  });

  it('keeps the last owner and cross-tenant memberships protected', async () => {
    const tenantA = await createTenantFixture(database, { label: 'Owner A' });
    const tenantB = await createTenantFixture(database, { label: 'Owner B' });
    const adminUser = await createUser(database, { email: 'admin-owner-test@example.test' });
    const adminMembership = await createMembership(database, {
      organizationId: tenantA.organization.id,
      userId: adminUser.id,
      role: 'ADMIN',
    });
    const admin = tenantContext(tenantA, adminUser.id, adminMembership.id, 'ADMIN');

    await expect(
      service.updateMember(admin, tenantA.establishment.id, tenantA.membership.id, {
        role: 'ADMIN',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PERMISSION_DENIED' }),
    });
    await expect(
      service.removeMember(tenantContext(tenantA), tenantA.establishment.id, tenantB.membership.id),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MEMBER_NOT_FOUND' }),
    });
    await expect(
      service.removeMember(tenantContext(tenantA), tenantA.establishment.id, tenantA.membership.id),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SELF_MANAGEMENT_NOT_ALLOWED' }),
    });
  });
});
