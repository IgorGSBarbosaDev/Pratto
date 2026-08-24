import type { EmailService } from '@pratto/contracts';

import type { PasswordService } from '../../identity/application/password.service';
import type { TenantPrincipal } from '../../identity/domain/auth.types';

const mockPrisma = {
  establishment: { findFirst: jest.fn() },
  membership: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  membershipInvitation: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  user: { findUnique: jest.fn(), create: jest.fn() },
  passwordCredential: { create: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

jest.mock('@pratto/config', () => ({
  loadEnvironment: () => ({ WEB_URL: 'http://localhost:3000', COOKIE_SECRET: 'test-secret' }),
}));
jest.mock('@pratto/database', () => ({
  ...jest.requireActual('@pratto/database'),
  prisma: mockPrisma,
}));

import { TeamService } from './team.service';

const date = new Date('2026-08-01T00:00:00.000Z');
const tenant = (role: TenantPrincipal['role'] = 'OWNER', userId = 'owner-id'): TenantPrincipal => ({
  sessionId: 'session-id',
  userId,
  rawToken: 'token',
  expiresAt: date,
  renewed: false,
  membershipId: 'owner-membership',
  organizationId: 'organization-id',
  role,
  establishmentIds: ['establishment-id'],
});

function member(id: string, role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER', userId = 'member-id') {
  return {
    id,
    userId,
    role,
    status: 'ACTIVE',
    createdAt: date,
    updatedAt: date,
    user: { name: `${role} User`, email: `${id}@example.com` },
  };
}

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invitation-id',
    establishmentId: 'establishment-id',
    organizationId: 'organization-id',
    email: 'invite@example.com',
    role: 'MEMBER',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    acceptedAt: null,
    canceledAt: null,
    createdAt: date,
    updatedAt: date,
    ...overrides,
  };
}

function usableAcceptanceInvitation(overrides: Record<string, unknown> = {}) {
  return invitation({
    establishment: {
      id: 'establishment-id',
      organizationId: 'organization-id',
      name: 'Casa Pratto',
      status: 'ACTIVE',
    },
    organization: { status: 'ACTIVE' },
    ...overrides,
  });
}

describe('TeamService business behavior', () => {
  let service: TeamService;
  let email: EmailService;
  const passwords = {
    hash: jest.fn().mockResolvedValue('password-hash'),
  } as unknown as PasswordService;

  beforeEach(() => {
    jest.clearAllMocks();
    email = { send: jest.fn().mockResolvedValue(undefined), health: jest.fn() };
    service = new TeamService(email, passwords);
    mockPrisma.$transaction.mockImplementation(
      async (callback: (client: typeof mockPrisma) => unknown) => callback(mockPrisma),
    );
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.establishment.findFirst.mockResolvedValue({
      id: 'establishment-id',
      name: 'Casa Pratto',
    });
  });

  it('returns tenant-scoped members and invitations, including expired pending status', async () => {
    mockPrisma.membership.findMany.mockResolvedValue([member('member-id', 'ADMIN')]);
    mockPrisma.membershipInvitation.findMany.mockResolvedValue([
      invitation({ expiresAt: new Date('2026-07-01T00:00:00.000Z') }),
    ]);

    await expect(service.getTeam(tenant(), 'establishment-id')).resolves.toMatchObject({
      establishmentId: 'establishment-id',
      members: [{ id: 'member-id', role: 'ADMIN', email: 'member-id@example.com' }],
      invitations: [{ id: 'invitation-id', status: 'EXPIRED' }],
    });
    expect(mockPrisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'organization-id', status: 'ACTIVE', user: { status: 'ACTIVE' } },
      }),
    );
    expect(mockPrisma.membershipInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'organization-id', establishmentId: 'establishment-id' },
      }),
    );
  });

  it('creates an invitation, hashes the token and sends an acceptance link', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.membershipInvitation.findFirst.mockResolvedValue(null);
    mockPrisma.membershipInvitation.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        invitation({ email: data.email, role: data.role, expiresAt: data.expiresAt }),
    );

    await expect(
      service.invite(tenant(), 'establishment-id', {
        email: 'new@example.com',
        role: 'ADMIN',
      }),
    ).resolves.toMatchObject({ email: 'new@example.com', role: 'ADMIN', status: 'PENDING' });
    expect(mockPrisma.membershipInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'organization-id',
          establishmentId: 'establishment-id',
          email: 'new@example.com',
          role: 'ADMIN',
          tokenHash: expect.any(String),
        }),
      }),
    );
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.com',
        subject: expect.stringContaining('Casa Pratto'),
        text: expect.stringContaining('/invitations/accept#token='),
      }),
    );
  });

  it('rejects active memberships and conflicting pending invitations', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-user',
      memberships: [{ status: 'ACTIVE' }],
    });
    await expect(
      service.invite(tenant(), 'establishment-id', {
        email: 'existing@example.com',
        role: 'MEMBER',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MEMBERSHIP_ALREADY_EXISTS' }),
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.membershipInvitation.findFirst.mockResolvedValue(
      invitation({ establishmentId: 'other-establishment' }),
    );
    await expect(
      service.invite(tenant(), 'establishment-id', {
        email: 'new@example.com',
        role: 'MEMBER',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITATION_ALREADY_PENDING' }),
    });
  });

  it('resends and cancels only pending invitations within the selected tenant', async () => {
    mockPrisma.membershipInvitation.findFirst.mockResolvedValue(invitation());
    mockPrisma.membershipInvitation.update.mockResolvedValue(invitation());
    await expect(
      service.resend(tenant(), 'establishment-id', 'invitation-id'),
    ).resolves.toMatchObject({
      status: 'PENDING',
      email: 'invite@example.com',
    });
    expect(email.send).toHaveBeenCalledTimes(1);

    mockPrisma.membershipInvitation.findFirst.mockResolvedValue({
      role: 'MEMBER',
      status: 'PENDING',
    });
    mockPrisma.membershipInvitation.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      service.cancel(tenant(), 'establishment-id', 'invitation-id'),
    ).resolves.toBeUndefined();
    expect(mockPrisma.membershipInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'organization-id', status: 'PENDING' }),
        data: expect.objectContaining({ status: 'CANCELED', tokenHash: expect.any(String) }),
      }),
    );

    mockPrisma.membershipInvitation.findFirst.mockResolvedValue({
      role: 'MEMBER',
      status: 'ACCEPTED',
    });
    await expect(
      service.cancel(tenant(), 'establishment-id', 'invitation-id'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITATION_NOT_FOUND' }),
    });
  });

  it('updates and removes members while protecting self-management and the last owner', async () => {
    mockPrisma.membership.findFirst.mockResolvedValue(member('member-id'));
    mockPrisma.membership.update.mockResolvedValue(member('member-id', 'ADMIN'));
    await expect(
      service.updateMember(tenant(), 'establishment-id', 'member-id', { role: 'ADMIN' }),
    ).resolves.toMatchObject({ id: 'member-id', role: 'ADMIN' });
    expect(mockPrisma.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'ADMIN' } }),
    );

    mockPrisma.membership.findFirst.mockResolvedValue(member('member-id'));
    await expect(
      service.removeMember(tenant(), 'establishment-id', 'member-id'),
    ).resolves.toBeUndefined();
    expect(mockPrisma.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'member-id' },
        data: { status: 'INACTIVE' },
      }),
    );

    mockPrisma.membership.findFirst.mockResolvedValue(
      member('owner-membership', 'OWNER', 'other-owner-id'),
    );
    mockPrisma.membership.count.mockResolvedValue(0);
    await expect(
      service.updateMember(
        tenant('OWNER', 'another-actor-id'),
        'establishment-id',
        'owner-membership',
        { role: 'ADMIN' },
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'LAST_OWNER_REQUIRED' }) });
    expect(mockPrisma.membership.update).toHaveBeenCalledTimes(2);

    mockPrisma.membership.findFirst.mockResolvedValue(
      member('owner-membership', 'MEMBER', 'owner-id'),
    );
    await expect(
      service.removeMember(tenant(), 'establishment-id', 'owner-membership'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SELF_MANAGEMENT_NOT_ALLOWED' }),
    });
  });

  it('previews valid invitations and accepts a new account atomically', async () => {
    mockPrisma.membershipInvitation.findUnique.mockResolvedValue(usableAcceptanceInvitation());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.preview('invitation-token')).resolves.toMatchObject({
      email: 'invite@example.com',
      role: 'MEMBER',
      establishmentName: 'Casa Pratto',
      accountExists: false,
    });

    mockPrisma.membershipInvitation.findUnique.mockResolvedValue(usableAcceptanceInvitation());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user',
      status: 'ACTIVE',
      credential: { userId: 'new-user' },
    });
    mockPrisma.membership.findUnique.mockResolvedValue(null);
    mockPrisma.membership.create.mockResolvedValue({});
    mockPrisma.membershipInvitation.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.accept({ token: 'invitation-token', name: 'New User', password: 'a'.repeat(15) }),
    ).resolves.toEqual({ email: 'invite@example.com', createdAccount: true, requiresLogin: true });
    expect(passwords.hash).toHaveBeenCalledWith('a'.repeat(15));
    expect(mockPrisma.membership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'organization-id',
          role: 'MEMBER',
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('rejects unusable invitations and missing account details', async () => {
    mockPrisma.membershipInvitation.findUnique.mockResolvedValue(null);
    await expect(service.preview('missing-token')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITATION_INVALID' }),
    });

    mockPrisma.membershipInvitation.findUnique.mockResolvedValue(usableAcceptanceInvitation());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.accept({ token: 'invitation-token' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ACCOUNT_DETAILS_REQUIRED' }),
    });

    mockPrisma.membershipInvitation.findUnique.mockResolvedValue(usableAcceptanceInvitation());
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-user',
      status: 'ACTIVE',
      credential: { userId: 'existing-user' },
    });
    mockPrisma.membership.findUnique.mockResolvedValue({ id: 'membership-id', status: 'ACTIVE' });
    await expect(service.accept({ token: 'invitation-token' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MEMBERSHIP_ALREADY_EXISTS' }),
    });
  });
});
