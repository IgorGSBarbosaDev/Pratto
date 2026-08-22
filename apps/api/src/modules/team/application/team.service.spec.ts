import { prisma } from '@pratto/database';

import type { TenantPrincipal } from '../../identity/domain/auth.types';

import { TeamService } from './team.service';

jest.mock('@pratto/config', () => ({
  loadEnvironment: () => ({ WEB_URL: 'http://localhost:3000', COOKIE_SECRET: 'test-secret' }),
}));

jest.mock('@pratto/database', () => ({
  Prisma: {},
  prisma: {
    establishment: { findFirst: jest.fn() },
    membership: { findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
  },
}));

const database = prisma as unknown as {
  establishment: { findFirst: jest.Mock };
  membership: { findFirst: jest.Mock; count: jest.Mock; update: jest.Mock };
};

const tenant = (role: TenantPrincipal['role']): TenantPrincipal => ({
  sessionId: 'session-id',
  userId: 'user-id',
  rawToken: 'raw-token',
  expiresAt: new Date(),
  renewed: false,
  membershipId: 'membership-id',
  organizationId: 'organization-id',
  role,
  establishmentIds: ['establishment-id'],
});

describe('TeamService authorization', () => {
  const email = { send: jest.fn(), health: jest.fn() };
  const passwords = { hash: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    database.establishment.findFirst.mockResolvedValue({ id: 'establishment-id', name: 'Pratto' });
  });

  it('denies members from inviting people', async () => {
    const service = new TeamService(email, passwords as never);

    await expect(
      service.invite(tenant('MEMBER'), 'establishment-id', {
        email: 'new@example.com',
        role: 'MEMBER',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PERMISSION_DENIED' }),
    });
    expect(database.establishment.findFirst).not.toHaveBeenCalled();
  });

  it('denies administrators from assigning the owner role', async () => {
    const service = new TeamService(email, passwords as never);

    await expect(
      service.invite(tenant('ADMIN'), 'establishment-id', {
        email: 'new@example.com',
        role: 'OWNER',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ROLE_ASSIGNMENT_DENIED' }),
    });
    expect(database.establishment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'establishment-id' }) }),
    );
  });

  it('keeps owner membership protected from administrators', async () => {
    database.membership.findFirst.mockResolvedValue({
      id: 'owner-membership',
      userId: 'owner-id',
      role: 'OWNER',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { name: 'Owner', email: 'owner@example.com' },
    });
    const service = new TeamService(email, passwords as never);

    await expect(
      service.updateMember(tenant('ADMIN'), 'establishment-id', 'owner-membership', {
        role: 'ADMIN',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TEAM_MEMBER_MANAGEMENT_DENIED' }),
    });
    expect(database.membership.update).not.toHaveBeenCalled();
  });
});
