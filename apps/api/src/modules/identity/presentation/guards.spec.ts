jest.mock('@pratto/config', () => ({
  loadEnvironment: () => ({
    WEB_URL: 'http://localhost:3000',
    COOKIE_SECRET: 'test-secret',
    COOKIE_SECURE: false,
  }),
}));
import { OrganizationGuard } from '../../organizations/presentation/organization.guard';
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from '../domain/auth.constants';
import { createCsrfToken } from '../domain/auth.crypto';

import { AuthenticatedGuard } from './authenticated.guard';
import { CsrfGuard } from './csrf.guard';
import { OriginGuard } from './origin.guard';

function executionContext(
  request: Record<string, unknown>,
  response: Record<string, unknown> = {},
) {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as never;
}

describe('identity and tenant guards', () => {
  it('authenticates the session cookie, stores the principal and renews its cookie when required', async () => {
    const authService = {
      authenticate: jest.fn().mockResolvedValue({
        sessionId: 'session-id',
        rawToken: 'token',
        expiresAt: new Date(),
        renewed: true,
      }),
    };
    const response = { cookie: jest.fn() };
    const request = { headers: { cookie: `${SESSION_COOKIE}=token` } };
    await expect(
      new AuthenticatedGuard(authService as never).canActivate(executionContext(request, response)),
    ).resolves.toBe(true);
    expect(request).toHaveProperty('auth.sessionId', 'session-id');
    expect(response.cookie).toHaveBeenCalledTimes(1);
  });

  it('requires an authenticated request before resolving tenant scope', async () => {
    const service = { resolveTenantPrincipal: jest.fn() };
    await expect(
      new OrganizationGuard(service as never).canActivate(executionContext({})),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AUTHENTICATION_REQUIRED', statusCode: 401 }),
    });
    const request = { auth: { sessionId: 'session-id' } };
    service.resolveTenantPrincipal.mockResolvedValue({ organizationId: 'organization-id' });
    await expect(
      new OrganizationGuard(service as never).canActivate(executionContext(request)),
    ).resolves.toBe(true);
    expect(request).toHaveProperty('tenant.organizationId', 'organization-id');
  });

  it('accepts a matching CSRF proof and rejects absent or mismatched proofs', () => {
    const sessionId = 'session-id';
    const token = createCsrfToken('test-secret', sessionId);
    const request = {
      auth: { sessionId },
      headers: { cookie: `${CSRF_COOKIE}=${token}` },
      header: (name: string) => (name === CSRF_HEADER ? token : undefined),
    };
    expect(new CsrfGuard().canActivate(executionContext(request))).toBe(true);
    const invalid = { ...request, header: () => 'different' };
    expect(() => new CsrfGuard().canActivate(executionContext(invalid))).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'CSRF_TOKEN_INVALID' }),
      }),
    );
  });

  it('accepts the configured origin or its referer and blocks foreign origins', () => {
    const guard = new OriginGuard();
    expect(
      guard.canActivate(
        executionContext({
          header: (name: string) => (name === 'origin' ? 'http://localhost:3000' : undefined),
        }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        executionContext({
          header: (name: string) =>
            name === 'referer' ? 'http://localhost:3000/login' : undefined,
        }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(executionContext({ header: () => 'https://evil.example' })),
    ).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'ORIGIN_INVALID' }) }),
    );
  });
});
