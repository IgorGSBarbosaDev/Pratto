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
  it('allows permissions granted to the active role', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(Permission.TEAM_INVITE) };
    const guard = new PermissionGuard(reflector as never);
    const request = { tenant: { role: 'ADMIN' } } as AuthenticatedRequest;

    expect(guard.canActivate(contextFor(request))).toBe(true);
  });

  it('rejects a role without the required permission', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(Permission.TEAM_INVITE) };
    const guard = new PermissionGuard(reflector as never);
    const request = { tenant: { role: 'MEMBER' } } as AuthenticatedRequest;

    expect(() => guard.canActivate(contextFor(request))).toThrow(StableHttpException);
    try {
      guard.canActivate(contextFor(request));
    } catch (error) {
      expect(error).toMatchObject({
        response: expect.objectContaining({
          statusCode: HttpStatus.FORBIDDEN,
          code: 'PERMISSION_DENIED',
        }),
      });
    }
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
