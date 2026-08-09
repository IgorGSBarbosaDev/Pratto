import { HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { AuthService } from '../../identity/application/auth.service';
import type { AuthenticatedRequest } from '../../identity/domain/auth.types';
import { OrganizationGuard } from '../../organizations/presentation/organization.guard';

function contextFor(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('OrganizationGuard for establishment routes', () => {
  it('rejects unauthenticated requests', async () => {
    const authService = { resolveTenantPrincipal: jest.fn() } as unknown as AuthService;
    const guard = new OrganizationGuard(authService);

    await expect(guard.canActivate(contextFor({} as AuthenticatedRequest))).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: HttpStatus.UNAUTHORIZED,
        code: 'AUTHENTICATION_REQUIRED',
      }),
    });
  });

  it('propagates authorization failure when the selected organization is unavailable', async () => {
    const authService = {
      resolveTenantPrincipal: jest
        .fn()
        .mockRejectedValue(
          new StableHttpException(
            HttpStatus.FORBIDDEN,
            'ORGANIZATION_ACCESS_DENIED',
            'Acesso negado.',
          ),
        ),
    } as unknown as AuthService;
    const guard = new OrganizationGuard(authService);
    const request = { auth: { userId: 'user-id' } } as AuthenticatedRequest;

    await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        code: 'ORGANIZATION_ACCESS_DENIED',
      }),
    });
  });
});
