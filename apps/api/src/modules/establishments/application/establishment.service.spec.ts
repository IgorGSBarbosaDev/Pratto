import type { StorageService } from '@pratto/contracts';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { TenantPrincipal } from '../../identity/domain/auth.types';

const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@pratto/database', () => ({
  prisma: {
    establishment: {
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
  },
}));

import { EstablishmentService } from './establishment.service';

const tenant: TenantPrincipal = {
  sessionId: 'session-id',
  userId: 'user-id',
  rawToken: 'token',
  expiresAt: new Date(),
  renewed: false,
  membershipId: 'membership-id',
  organizationId: 'organization-a',
  role: 'OWNER',
  establishmentIds: ['establishment-a'],
};

const currentRecord = {
  id: 'establishment-a',
  publicId: 'public-a',
  name: 'Casa A',
  slug: 'casa-a',
  description: null,
  phone: null,
  whatsapp: null,
  address: null,
  operatingHours: {},
  logoKey: null,
  logoContentType: null,
  coverImageKey: null,
  coverImageContentType: null,
  themeSettings: { mode: 'LIGHT', primaryColor: '#166534' },
};

function createService() {
  const storage: StorageService = {
    upload: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest.fn((key: string) => `http://storage.test/${key}`),
    getReadUrl: jest.fn((key: string) => Promise.resolve(`http://storage.test/signed/${key}`)),
    health: jest.fn(),
  };
  return { service: new EstablishmentService(storage), storage };
}

describe('EstablishmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads only an active establishment from the current organization', async () => {
    mockFindFirst.mockResolvedValue(currentRecord);
    const { service } = createService();

    await expect(service.getSettings(tenant, 'establishment-a')).resolves.toMatchObject({
      id: 'establishment-a',
      name: 'Casa A',
      theme: { mode: 'LIGHT', primaryColor: '#166534' },
    });
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'establishment-a', organizationId: 'organization-a', status: 'ACTIVE' },
      }),
    );
  });

  it('updates through the composite tenant key and returns the new settings', async () => {
    mockFindFirst.mockResolvedValue(currentRecord);
    mockUpdate.mockResolvedValue({ ...currentRecord, name: 'Casa A Atualizada' });
    const { service } = createService();

    await expect(
      service.updateSettings(tenant, 'establishment-a', {
        name: 'Casa A Atualizada',
        theme: { mode: 'DARK', primaryColor: '#0f766e' },
      }),
    ).resolves.toMatchObject({ name: 'Casa A Atualizada' });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id_organizationId: { id: 'establishment-a', organizationId: 'organization-a' },
        },
        data: {
          name: 'Casa A Atualizada',
          themeSettings: { mode: 'DARK', primaryColor: '#0f766e' },
        },
      }),
    );
  });

  it('does not query or update an establishment outside the resolved tenant', async () => {
    const { service } = createService();

    await expect(service.getSettings(tenant, 'establishment-b')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ESTABLISHMENT_NOT_FOUND' }),
    });
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects invalid image uploads before touching storage', async () => {
    mockFindFirst.mockResolvedValue(currentRecord);
    const { service, storage } = createService();

    await expect(
      service.uploadAsset(tenant, 'establishment-a', 'logo', {
        buffer: new Uint8Array([1]),
        mimetype: 'application/pdf',
        size: 1,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ESTABLISHMENT_IMAGE_TYPE_INVALID' }),
    });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('maps slug uniqueness conflicts to a stable API error', async () => {
    mockFindFirst.mockResolvedValue(currentRecord);
    mockUpdate.mockRejectedValue({ code: 'P2002' });
    const { service } = createService();

    await expect(
      service.updateSettings(tenant, 'establishment-a', { slug: 'duplicated' }),
    ).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({
          code: 'ESTABLISHMENT_SLUG_ALREADY_IN_USE',
          statusCode: 409,
        }),
      }),
    );
  });

  it('keeps stable exceptions intact', () => {
    const error = new StableHttpException(400, 'VALIDATION_ERROR', 'invalid');
    expect(error.getStatus()).toBe(400);
  });
});
