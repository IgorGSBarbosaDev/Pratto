import type { StorageService } from '@pratto/contracts';

import type { TenantPrincipal } from '../../identity/domain/auth.types';

const mockPublicationReferencesStorageKey = jest.fn();
const mockPrisma = { establishment: { findFirst: jest.fn(), update: jest.fn() } };
jest.mock('@pratto/database', () => ({
  prisma: mockPrisma,
  Prisma: { DbNull: Symbol('DbNull') },
  publicationReferencesStorageKey: mockPublicationReferencesStorageKey,
}));

import { EstablishmentService } from './establishment.service';

const date = new Date('2026-08-01T00:00:00.000Z');
const tenant = (role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER'): TenantPrincipal => ({
  sessionId: 'session-id',
  userId: 'user-id',
  rawToken: 'token',
  expiresAt: date,
  renewed: false,
  membershipId: 'membership-id',
  organizationId: 'organization-id',
  role,
  establishmentIds: ['establishment-id'],
});
const record = {
  id: 'establishment-id',
  publicId: 'public-id',
  name: 'Casa',
  slug: 'casa',
  description: null,
  phone: null,
  whatsapp: null,
  address: null,
  operatingHours: {},
  timeZone: 'America/Sao_Paulo',
  logoKey: 'old-logo.png',
  logoContentType: 'image/png',
  coverImageKey: null,
  coverImageContentType: null,
  themeSettings: { mode: 'LIGHT', primaryColor: '#166534' },
};

describe('EstablishmentService behavior', () => {
  let service: EstablishmentService;
  let storage: StorageService;
  beforeEach(() => {
    jest.clearAllMocks();
    storage = {
      upload: jest.fn().mockResolvedValue({
        key: 'new-logo.png',
        contentType: 'image/png',
        contentLength: 8,
        publicUrl: 'public',
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      getPublicUrl: jest.fn((key: string) => `public:${key}`),
      getReadUrl: jest.fn(),
      health: jest.fn(),
    };
    service = new EstablishmentService(storage);
    mockPrisma.establishment.findFirst.mockResolvedValue(record);
    mockPublicationReferencesStorageKey.mockResolvedValue(false);
    mockPrisma.establishment.update.mockResolvedValue({
      ...record,
      logoKey: 'new-logo.png',
      logoContentType: 'image/png',
    });
  });

  it('allows owner settings mutations and replaces/removes prior assets transactionally at the adapter boundary', async () => {
    const file = {
      buffer: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      mimetype: 'image/png',
      size: 8,
    };
    await expect(
      service.uploadAsset(tenant(), 'establishment-id', 'logo', file),
    ).resolves.toMatchObject({ logo: { url: expect.any(String) } });
    expect(storage.upload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'image/png', contentLength: 8 }),
    );
    expect(storage.delete).toHaveBeenCalledWith('old-logo.png');
    await expect(service.removeAsset(tenant(), 'establishment-id', 'logo')).resolves.toBeDefined();
    expect(mockPrisma.establishment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { logoKey: null, logoContentType: null } }),
    );
  });

  it('keeps MEMBER read-only and cleans uploaded objects if persistence fails', async () => {
    await expect(
      service.updateSettings(tenant('MEMBER'), 'establishment-id', { name: 'Blocked' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PERMISSION_DENIED', statusCode: 403 }),
    });
    mockPrisma.establishment.update.mockRejectedValue(new Error('database failure'));
    await expect(
      service.uploadAsset(tenant(), 'establishment-id', 'cover', {
        buffer: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
        mimetype: 'image/png',
        size: 8,
      }),
    ).rejects.toThrow('database failure');
    expect(storage.delete).toHaveBeenCalledWith('new-logo.png');
  });
});
