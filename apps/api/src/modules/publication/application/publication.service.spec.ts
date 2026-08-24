const databaseService = {
  publish: jest.fn(),
  getActive: jest.fn(),
  listHistory: jest.fn(),
};
const DatabasePublicationServiceMock = jest.fn().mockImplementation(() => databaseService);

class MockMenuPublicationServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

jest.mock('@pratto/database', () => ({
  prisma: {},
  MenuPublicationService: DatabasePublicationServiceMock,
  MenuPublicationServiceError: MockMenuPublicationServiceError,
}));

import type { TenantPrincipal } from '../../identity/domain/auth.types';

import { PublicationService } from './publication.service';

const tenant: TenantPrincipal = {
  sessionId: 'session-id',
  userId: 'user-id',
  rawToken: 'token',
  expiresAt: new Date('2026-08-01T00:00:00.000Z'),
  renewed: false,
  membershipId: 'membership-id',
  organizationId: 'organization-id',
  role: 'OWNER',
  establishmentIds: ['establishment-id'],
};
const publication = {
  id: 'publication-id',
  menuId: 'menu-id',
  version: 3,
  snapshot: { products: [] },
  publishedAt: new Date('2026-08-01T12:00:00.000Z'),
  publishedBy: 'user-id',
};

describe('PublicationService', () => {
  let service: PublicationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PublicationService({} as never);
  });

  it('publishes and serializes a database publication while preserving tenant and idempotency inputs', async () => {
    databaseService.publish.mockResolvedValue(publication);
    await expect(service.publish(tenant, 'menu-id', 'request-1')).resolves.toEqual({
      id: 'publication-id',
      menuId: 'menu-id',
      version: 3,
      snapshot: { products: [] },
      publishedAt: '2026-08-01T12:00:00.000Z',
      publishedBy: 'user-id',
    });
    expect(databaseService.publish).toHaveBeenCalledWith({
      menuId: 'menu-id',
      tenant,
      idempotencyKey: 'request-1',
    });
  });

  it('returns active state and bounded history, including null and non-record snapshots safely', async () => {
    databaseService.getActive.mockResolvedValue({
      publication: null,
      hasUnpublishedChanges: false,
    });
    await expect(service.getActive(tenant, 'menu-id')).resolves.toEqual({
      menuId: 'menu-id',
      publication: null,
      hasUnpublishedChanges: false,
    });

    databaseService.listHistory.mockResolvedValue([
      publication,
      { ...publication, id: 'publication-2', version: 2, snapshot: ['not-a-record'] },
    ]);
    await expect(service.listHistory(tenant, 'menu-id')).resolves.toEqual({
      menuId: 'menu-id',
      publications: [
        {
          id: 'publication-id',
          menuId: 'menu-id',
          version: 3,
          publishedAt: '2026-08-01T12:00:00.000Z',
          publishedBy: 'user-id',
        },
        {
          id: 'publication-2',
          menuId: 'menu-id',
          version: 2,
          publishedAt: '2026-08-01T12:00:00.000Z',
          publishedBy: 'user-id',
        },
      ],
    });
  });

  it.each([
    ['PUBLICATION_ACCESS_DENIED', 403],
    ['MENU_NOT_FOUND', 404],
    ['MENU_ARCHIVED', 409],
    ['PUBLICATION_STATE_UNAVAILABLE', 503],
    ['IDEMPOTENCY_KEY_INVALID', 400],
  ])('maps %s to its stable HTTP status', async (code, status) => {
    databaseService.publish.mockRejectedValue(new MockMenuPublicationServiceError(code, 'failure'));
    await expect(service.publish(tenant, 'menu-id', 'key')).rejects.toMatchObject({
      response: expect.objectContaining({ code, statusCode: status }),
    });
  });

  it('maps concurrent database conflicts and preserves unrelated failures', async () => {
    databaseService.publish.mockRejectedValue({ code: 'P2002' });
    await expect(service.publish(tenant, 'menu-id', 'key')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PUBLICATION_CONFLICT', statusCode: 409 }),
    });
    databaseService.publish.mockRejectedValue({ code: 'P2034' });
    await expect(service.publish(tenant, 'menu-id', 'key')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PUBLICATION_CONFLICT', statusCode: 409 }),
    });
    const unexpected = new Error('unexpected');
    databaseService.publish.mockRejectedValue(unexpected);
    await expect(service.publish(tenant, 'menu-id', 'key')).rejects.toBe(unexpected);
  });
});
