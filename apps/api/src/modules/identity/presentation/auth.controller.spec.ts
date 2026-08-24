jest.mock('@pratto/config', () => ({
  loadEnvironment: () => ({
    WEB_URL: 'http://localhost:3000',
    COOKIE_SECRET: 'test-secret',
    COOKIE_SECURE: false,
  }),
}));
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from '../domain/auth.constants';
import { createCsrfToken } from '../domain/auth.crypto';

import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const service = {
    login: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    getContext: jest.fn(),
    selectOrganization: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    authenticate: jest.fn(),
  };
  const response = { cookie: jest.fn(), clearCookie: jest.fn() };
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(service as never);
  });

  it('validates login, delegates the client tracker and sets session and CSRF cookies', async () => {
    const expiresAt = new Date('2026-08-23T12:00:00.000Z');
    service.login.mockResolvedValue({
      token: 'session-token',
      sessionId: 'session-id',
      expiresAt,
      context: { user: {} },
    });
    const request = { ip: '192.0.2.1', socket: {} } as never;
    await expect(
      controller.login(
        { email: ' USER@EXAMPLE.COM ', password: 'secret' },
        request,
        response as never,
      ),
    ).resolves.toEqual({ user: {} });
    expect(service.login).toHaveBeenCalledWith(
      { email: 'user@example.com', password: 'secret' },
      '192.0.2.1',
    );
    expect(response.cookie).toHaveBeenCalledTimes(2);
    expect(response.cookie.mock.calls.map(([name]) => name)).toEqual(
      expect.arrayContaining([SESSION_COOKIE, CSRF_COOKIE]),
    );
  });

  it('rejects malformed bodies and keeps logout idempotent without a session cookie', async () => {
    await expect(
      controller.login({ email: 'bad', password: '' }, { ip: 'ip' } as never, response as never),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
    await expect(
      controller.logout({ headers: {}, ip: 'ip' } as never, response as never),
    ).resolves.toBeUndefined();
    expect(service.login).not.toHaveBeenCalled();
    expect(service.logout).toHaveBeenCalledWith(undefined);
    expect(response.clearCookie).toHaveBeenCalledTimes(2);
  });

  it('exposes context, organization selection, password recovery and CSRF only through validated inputs', async () => {
    service.getContext.mockResolvedValue({});
    service.selectOrganization.mockResolvedValue({});
    service.forgotPassword.mockResolvedValue(undefined);
    service.resetPassword.mockResolvedValue(undefined);
    const auth = { sessionId: 'session-id', expiresAt: new Date('2026-08-23T12:00:00.000Z') };
    await controller.getMe({ auth } as never);
    await controller.selectOrganization({ membershipId: '11111111-1111-4111-8111-111111111111' }, {
      auth,
    } as never);
    await expect(
      controller.forgotPassword({ email: 'user@example.com' }, { ip: 'ip' } as never),
    ).resolves.toEqual({ message: expect.any(String) });
    await expect(
      controller.resetPassword({ token: 't'.repeat(40), password: 'a'.repeat(15) }, {
        ip: 'ip',
      } as never),
    ).resolves.toBeUndefined();
    const csrfResponse = await controller.csrf({ auth } as never, response as never);
    expect(csrfResponse.csrfToken).toEqual(expect.any(String));
    expect(service.selectOrganization).toHaveBeenCalledWith(
      auth,
      '11111111-1111-4111-8111-111111111111',
    );
    expect(service.forgotPassword).toHaveBeenCalledWith('user@example.com', 'ip');
    expect(service.resetPassword).toHaveBeenCalledWith('t'.repeat(40), 'a'.repeat(15), 'ip');
  });

  it('validates CSRF for a present logout session before revocation', async () => {
    const token = 'session-token';
    const sessionId = 'session-id';
    const csrf = createCsrfToken('test-secret', sessionId);
    service.authenticate.mockResolvedValue({ sessionId, expiresAt: new Date() });
    const request = {
      headers: { cookie: `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=${csrf}` },
      header: (name: string) => (name === CSRF_HEADER ? csrf : undefined),
      ip: 'ip',
    };
    await expect(controller.logout(request as never, response as never)).resolves.toBeUndefined();
    expect(service.logout).toHaveBeenCalledWith(token);
  });
});
