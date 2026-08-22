import { HttpStatus } from '@nestjs/common';
import { Permission } from '@pratto/contracts';

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
});
