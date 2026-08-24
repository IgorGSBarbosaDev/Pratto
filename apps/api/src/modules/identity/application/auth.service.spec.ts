const mockPrisma = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), findFirstOrThrow: jest.fn() },
  session: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  membership: { findFirst: jest.fn() },
  passwordResetToken: { upsert: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
  passwordCredential: { upsert: jest.fn() },
  authenticationEvent: { create: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('@pratto/config', () => ({
  loadEnvironment: () => ({ WEB_URL: 'http://localhost:3000', COOKIE_SECRET: 'test-secret' }),
}));
jest.mock('@pratto/database', () => ({ prisma: mockPrisma }));

import { StableHttpException } from '../../../common/http/stable-http.exception';

import { AuthService } from './auth.service';

const basePrincipal = {
  sessionId: 'session-id',
  userId: 'user-id',
  rawToken: 'raw-token',
  expiresAt: new Date('2026-08-01T00:30:00.000Z'),
  renewed: false,
};
const membership = {
  id: 'membership-id',
  role: 'OWNER',
  organization: {
    id: 'organization-id',
    name: 'Organization',
    establishments: [{ id: 'establishment-id', publicId: 'public-id', name: 'Casa', slug: 'casa' }],
  },
};

function contextUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-id',
    email: 'user@example.com',
    name: 'User',
    memberships: [membership],
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  const passwords = { verify: jest.fn(), hash: jest.fn() };
  const rateLimits = { consume: jest.fn().mockResolvedValue(undefined) };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn() };
  const email = { send: jest.fn().mockResolvedValue(undefined), health: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(passwords as never, rateLimits as never, logger as never, email);
    mockPrisma.$transaction.mockImplementation((value: unknown) => {
      if (Array.isArray(value)) return Promise.resolve(value);
      return Promise.resolve((value as (client: typeof mockPrisma) => unknown)(mockPrisma));
    });
    mockPrisma.authenticationEvent.create.mockResolvedValue({});
    mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });
    passwords.verify.mockResolvedValue(true);
    passwords.hash.mockResolvedValue('new-password-hash');
  });

  it('logs in active users, creates an opaque session and returns the selected context', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      status: 'ACTIVE',
      credential: { passwordHash: 'hash' },
      memberships: [{ id: 'membership-id' }],
    });
    mockPrisma.session.create.mockResolvedValue({ id: 'session-id' });
    mockPrisma.user.findFirstOrThrow.mockResolvedValue(contextUser());
    mockPrisma.session.findUniqueOrThrow.mockResolvedValue({ activeMembershipId: 'membership-id' });

    const result = await service.login(
      { email: 'user@example.com', password: 'password' },
      '127.0.0.1',
    );
    expect(result).toMatchObject({
      sessionId: 'session-id',
      token: expect.any(String),
      context: {
        activeOrganization: { id: 'organization-id', role: 'OWNER' },
        organizationSelectionRequired: false,
      },
    });
    expect(rateLimits.consume).toHaveBeenNthCalledWith(
      1,
      'login:email',
      'user@example.com',
      5,
      900000,
    );
    expect(rateLimits.consume).toHaveBeenNthCalledWith(2, 'login:ip', '127.0.0.1', 30, 900000);
    expect(mockPrisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-id',
          tokenHash: expect.any(String),
          activeMembershipId: 'membership-id',
        }),
      }),
    );
    expect(mockPrisma.authenticationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'LOGIN',
          outcome: 'SUCCESS',
          userId: 'user-id',
        }),
      }),
    );
  });

  it('uses one stable invalid-credentials response and audits inactive/incorrect logins', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      status: 'INACTIVE',
      credential: { passwordHash: 'hash' },
      memberships: [],
    });
    passwords.verify.mockResolvedValue(false);
    await expect(
      service.login({ email: 'user@example.com', password: 'bad' }, 'ip'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_CREDENTIALS', statusCode: 401 }),
    });
    expect(mockPrisma.authenticationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'LOGIN', outcome: 'FAILURE' }),
      }),
    );

    const blocked = new StableHttpException(429, 'RATE_LIMIT_EXCEEDED', 'blocked');
    rateLimits.consume.mockRejectedValueOnce(blocked);
    await expect(
      service.login({ email: 'user@example.com', password: 'password' }, 'ip'),
    ).rejects.toBe(blocked);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.authenticationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'LOGIN', outcome: 'BLOCKED' }),
      }),
    );
  });

  it('authenticates, renews after the threshold, and rejects absent, revoked, expired or inactive sessions', async () => {
    await expect(service.authenticate(undefined)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AUTHENTICATION_REQUIRED' }),
    });
    mockPrisma.session.findUnique.mockResolvedValue(null);
    await expect(service.authenticate('token')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AUTHENTICATION_REQUIRED' }),
    });
    mockPrisma.session.findUnique.mockResolvedValue({
      ...basePrincipal,
      id: 'session-id',
      userId: 'user-id',
      revokedAt: new Date(),
      user: { status: 'ACTIVE' },
    });
    await expect(service.authenticate('token')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SESSION_REVOKED' }),
    });
    mockPrisma.session.findUnique.mockResolvedValue({
      ...basePrincipal,
      id: 'session-id',
      expiresAt: new Date(Date.now() - 1),
      absoluteExpiresAt: new Date(Date.now() + 10_000),
      revokedAt: null,
      user: { status: 'ACTIVE' },
      createdAt: new Date(),
    });
    await expect(service.authenticate('token')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SESSION_EXPIRED' }),
    });

    mockPrisma.session.findUnique.mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      expiresAt: new Date(Date.now() + 1000),
      absoluteExpiresAt: new Date(Date.now() + 86_400_000),
      lastSeenAt: new Date(Date.now() - 16 * 60_000),
      createdAt: new Date(Date.now() - 16 * 60_000),
      revokedAt: null,
      user: { status: 'ACTIVE' },
    });
    const renewed = await service.authenticate('token');
    expect(renewed).toMatchObject({ sessionId: 'session-id', rawToken: 'token', renewed: true });
    expect(mockPrisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'session-id' } }),
    );

    mockPrisma.session.findUnique.mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      expiresAt: new Date(Date.now() + 1000),
      absoluteExpiresAt: new Date(Date.now() + 86_400_000),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      revokedAt: null,
      user: { status: 'INACTIVE' },
    });
    await expect(service.authenticate('token')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AUTHENTICATION_REQUIRED' }),
    });
  });

  it('requires organization selection for multiple memberships and resolves only active tenant membership', async () => {
    const organizations = [
      membership,
      {
        ...membership,
        id: 'membership-2',
        organization: {
          ...membership.organization,
          id: 'organization-2',
          name: 'Second',
          establishments: [],
        },
      },
    ];
    mockPrisma.user.findFirstOrThrow.mockResolvedValue(contextUser({ memberships: organizations }));
    mockPrisma.session.findUniqueOrThrow.mockResolvedValue({ activeMembershipId: null });
    await expect(service.getContext(basePrincipal)).resolves.toMatchObject({
      activeOrganization: null,
      organizationSelectionRequired: true,
      organizations: expect.arrayContaining([
        expect.objectContaining({ id: 'organization-id' }),
        expect.objectContaining({ id: 'organization-2' }),
      ]),
    });

    mockPrisma.session.findUniqueOrThrow.mockResolvedValue({ activeMembershipId: 'membership-id' });
    mockPrisma.membership.findFirst.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'organization-id',
      role: 'OWNER',
      organization: { establishments: [{ id: 'establishment-id' }] },
    });
    await expect(service.resolveTenantPrincipal(basePrincipal)).resolves.toMatchObject({
      organizationId: 'organization-id',
      role: 'OWNER',
      establishmentIds: ['establishment-id'],
    });

    mockPrisma.session.findUniqueOrThrow.mockResolvedValue({ activeMembershipId: null });
    await expect(service.resolveTenantPrincipal(basePrincipal)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ORGANIZATION_SELECTION_REQUIRED' }),
    });
  });

  it('selects an accessible organization and rejects another user membership', async () => {
    mockPrisma.membership.findFirst.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'organization-id',
    });
    mockPrisma.user.findFirstOrThrow.mockResolvedValue(contextUser());
    mockPrisma.session.findUniqueOrThrow.mockResolvedValue({ activeMembershipId: 'membership-id' });
    await expect(service.selectOrganization(basePrincipal, 'membership-id')).resolves.toMatchObject(
      {
        activeOrganization: { id: 'organization-id' },
      },
    );
    expect(mockPrisma.session.update).toHaveBeenCalledWith({
      where: { id: 'session-id' },
      data: { activeMembershipId: 'membership-id' },
    });

    mockPrisma.membership.findFirst.mockResolvedValue(null);
    await expect(
      service.selectOrganization(basePrincipal, 'other-membership'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ORGANIZATION_ACCESS_DENIED' }),
    });
  });

  it('logs out one session idempotently and revokes every session on logout-all', async () => {
    await expect(service.logout(undefined)).resolves.toBeUndefined();
    mockPrisma.session.findUnique.mockResolvedValue({ id: 'session-id', userId: 'user-id' });
    await expect(service.logout('token')).resolves.toBeUndefined();
    expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-id', revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
    await expect(service.logoutAll(basePrincipal)).resolves.toBeUndefined();
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Array));
  });

  it('keeps password recovery neutral for unknown users and sends one-time reset links for known users', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    await expect(service.forgotPassword('missing@example.com', 'ip')).resolves.toBeUndefined();
    expect(email.send).not.toHaveBeenCalled();

    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-id', email: 'user@example.com' });
    await expect(service.forgotPassword('user@example.com', 'ip')).resolves.toBeUndefined();
    expect(mockPrisma.passwordResetToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-id' },
        create: expect.objectContaining({ tokenHash: expect.any(String) }),
      }),
    );
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        text: expect.stringContaining('/reset-password#token='),
      }),
    );
  });

  it('rejects invalid and expired reset tokens and atomically resets a valid password', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);
    await expect(service.resetPassword('token', 'new-password', 'ip')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PASSWORD_RESET_TOKEN_INVALID' }),
    });
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-id',
      userId: 'user-id',
      usedAt: null,
      expiresAt: new Date(Date.now() - 1),
    });
    await expect(service.resetPassword('token', 'new-password', 'ip')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PASSWORD_RESET_TOKEN_EXPIRED' }),
    });

    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-id',
      userId: 'user-id',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockPrisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.resetPassword('token', 'new-password', 'ip')).resolves.toBeUndefined();
    expect(passwords.hash).toHaveBeenCalledWith('new-password');
    expect(mockPrisma.passwordCredential.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-id' } }),
    );
    expect(mockPrisma.session.updateMany).toHaveBeenCalled();
  });
});
