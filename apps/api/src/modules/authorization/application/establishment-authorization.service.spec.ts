import { HttpStatus } from '@nestjs/common';
import { Permission } from '@pratto/contracts';
import { prisma } from '@pratto/database';

import type { TenantPrincipal } from '../../identity/domain/auth.types';

import { EstablishmentAuthorizationService } from './establishment-authorization.service';

jest.mock('@pratto/database', () => ({
  prisma: {
    establishment: { findFirst: jest.fn() },
    membership: { findFirst: jest.fn() },
    menu: { findFirst: jest.fn() },
  },
}));

const database = prisma as unknown as {
  establishment: { findFirst: jest.Mock };
  membership: { findFirst: jest.Mock };
  menu: { findFirst: jest.Mock };
};

const tenant = {
  sessionId: 'session-id',
  userId: '11111111-1111-4111-8111-111111111111',
  rawToken: 'raw-token',
  expiresAt: new Date(),
  renewed: false,
  membershipId: '22222222-2222-4222-8222-222222222222',
  organizationId: '33333333-3333-4333-8333-333333333333',
  role: 'OWNER',
  establishmentIds: ['44444444-4444-4444-8444-444444444444'],
} satisfies TenantPrincipal;

describe('EstablishmentAuthorizationService', () => {
  const service = new EstablishmentAuthorizationService();

  beforeEach(() => {
    jest.clearAllMocks();
    database.establishment.findFirst.mockResolvedValue({ id: tenant.establishmentIds[0] });
    database.menu.findFirst.mockResolvedValue({ id: '55555555-5555-4555-8555-555555555555' });
    database.membership.findFirst.mockResolvedValue({ id: tenant.membershipId, role: 'OWNER' });
  });

  it('authorizes an active member against an establishment scoped to the session organization', async () => {
    await expect(
      service.requireEstablishmentPermission(
        tenant,
        tenant.establishmentIds[0]!,
        Permission.SETTINGS_MANAGE,
      ),
    ).resolves.toEqual({ membershipId: tenant.membershipId, role: 'OWNER' });

    expect(database.establishment.findFirst).toHaveBeenCalledWith({
      where: {
        id: tenant.establishmentIds[0],
        organizationId: tenant.organizationId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    expect(database.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: tenant.membershipId,
          organizationId: tenant.organizationId,
          userId: tenant.userId,
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('rejects a session whose membership is no longer active', async () => {
    database.membership.findFirst.mockResolvedValue(null);

    await expect(service.requirePermission(tenant, Permission.CATALOG_READ)).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        code: 'ESTABLISHMENT_ACCESS_DENIED',
      }),
    });
  });

  it.each([
    ['MEMBER', Permission.TEAM_MANAGE],
    ['ADMIN', Permission.OWNERSHIP_MANAGE],
  ] as const)('rejects %s when requesting %s', async (role, permission) => {
    database.membership.findFirst.mockResolvedValue({ id: tenant.membershipId, role });

    await expect(service.requirePermission(tenant, permission)).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        code: 'PERMISSION_DENIED',
      }),
    });
  });

  it('hides cross-establishment and cross-menu targets before permission evaluation', async () => {
    database.establishment.findFirst.mockResolvedValue(null);
    await expect(
      service.requireEstablishmentPermission(
        tenant,
        '66666666-6666-4666-8666-666666666666',
        Permission.ESTABLISHMENT_READ,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ statusCode: HttpStatus.NOT_FOUND }),
    });
    expect(database.membership.findFirst).not.toHaveBeenCalled();

    database.menu.findFirst.mockResolvedValue(null);
    await expect(
      service.requireMenuPermission(
        tenant,
        '77777777-7777-4777-8777-777777777777',
        Permission.CATALOG_READ,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        code: 'MENU_NOT_FOUND',
      }),
    });
  });
});
