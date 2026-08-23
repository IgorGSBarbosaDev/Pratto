import { HttpStatus } from '@nestjs/common';
import { hasPermission, Permission, permissionsForRole } from '@pratto/contracts';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { AuthenticatedRequest } from '../../identity/domain/auth.types';

import { PermissionGuard } from './permission.guard';

function contextFor(request: AuthenticatedRequest) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('PermissionGuard', () => {
  const authorization = {
    requirePermission: jest.fn(),
    requireEstablishmentPermission: jest.fn(),
    requireMenuPermission: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authorization.requirePermission.mockResolvedValue({
      membershipId: 'membership-id',
      role: 'ADMIN',
    });
  });

  it('allows permissions granted by the current active membership', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(Permission.TEAM_INVITE) };
    const guard = new PermissionGuard(reflector as never, authorization as never);
    const originalTenant = { role: 'MEMBER' } as never;
    const request = { tenant: originalTenant } as unknown as AuthenticatedRequest;

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(authorization.requirePermission).toHaveBeenCalledWith(
      originalTenant,
      Permission.TEAM_INVITE,
    );
    expect(request.tenant?.role).toBe('ADMIN');
  });

  it('propagates a permission denial from the active membership lookup', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(Permission.TEAM_INVITE) };
    authorization.requirePermission.mockRejectedValue(
      new StableHttpException(HttpStatus.FORBIDDEN, 'PERMISSION_DENIED', 'Permissão negada.'),
    );
    const guard = new PermissionGuard(reflector as never, authorization as never);
    const request = { tenant: { role: 'MEMBER' } } as AuthenticatedRequest;

    await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        code: 'PERMISSION_DENIED',
      }),
    });
  });

  it('authorizes valid establishment and menu route targets before the handler', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(Permission.CATALOG_WRITE) };
    authorization.requireEstablishmentPermission.mockResolvedValue({
      membershipId: 'membership-id',
      role: 'OWNER',
    });
    authorization.requireMenuPermission.mockResolvedValue({
      membershipId: 'membership-id',
      role: 'ADMIN',
    });
    const guard = new PermissionGuard(reflector as never, authorization as never);
    const tenant = { role: 'ADMIN' } as never;

    await guard.canActivate(
      contextFor({
        tenant,
        params: { establishmentId: '11111111-1111-4111-8111-111111111111' },
      } as unknown as AuthenticatedRequest),
    );
    await guard.canActivate(
      contextFor({
        tenant,
        params: { menuId: '22222222-2222-4222-8222-222222222222' },
      } as unknown as AuthenticatedRequest),
    );

    expect(authorization.requireEstablishmentPermission).toHaveBeenCalledWith(
      tenant,
      '11111111-1111-4111-8111-111111111111',
      Permission.CATALOG_WRITE,
    );
    expect(authorization.requireMenuPermission).toHaveBeenCalledWith(
      tenant,
      '22222222-2222-4222-8222-222222222222',
      Permission.CATALOG_WRITE,
    );
  });

  it('keeps sensitive establishment permissions exclusive to owners', () => {
    expect(hasPermission('OWNER', Permission.SETTINGS_MANAGE)).toBe(true);
    expect(hasPermission('OWNER', Permission.OWNERSHIP_MANAGE)).toBe(true);
    expect(hasPermission('ADMIN', Permission.SETTINGS_MANAGE)).toBe(false);
    expect(hasPermission('ADMIN', Permission.OWNERSHIP_MANAGE)).toBe(false);
    expect(hasPermission('MEMBER', Permission.TEAM_READ)).toBe(false);
  });

  it('exposes a single static permission set for each supported role', () => {
    expect(permissionsForRole('OWNER')).toEqual(Object.values(Permission));
    expect(permissionsForRole('ADMIN')).toContain(Permission.TEAM_MANAGE);
    expect(permissionsForRole('ADMIN')).not.toContain(Permission.OWNERSHIP_MANAGE);
    expect(permissionsForRole('MEMBER')).toEqual([
      Permission.ESTABLISHMENT_READ,
      Permission.CATALOG_READ,
    ]);
  });
});
