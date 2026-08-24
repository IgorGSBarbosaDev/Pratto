import type { StorageService } from '@pratto/contracts';

import type { TenantPrincipal } from '../../identity/domain/auth.types';

const mockPrisma = {
  product: { findFirst: jest.fn() },
  productMedia: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};
jest.mock('@pratto/database', () => ({ prisma: mockPrisma }));

import { ProductMediaService } from './product-media.service';

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
function media(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: 'organization-id',
    menuId: 'menu-id',
    productId: 'product-id',
    mediaType: 'IMAGE',
    contentType: 'image/png',
    originalName: `${id}.png`,
    storageKey: `${id}.png`,
    sizeBytes: 8,
    displayOrder: 0,
    isPrimary: true,
    createdAt: date,
    updatedAt: date,
    ...overrides,
  };
}
const product = {
  id: 'product-id',
  organizationId: 'organization-id',
  menuId: 'menu-id',
  status: 'ACTIVE',
  archivedAt: null,
};
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('ProductMediaService behavior', () => {
  let service: ProductMediaService;
  let storage: StorageService;

  beforeEach(() => {
    jest.resetAllMocks();
    storage = {
      upload: jest.fn().mockResolvedValue({
        key: 'stored-key',
        contentType: 'image/png',
        contentLength: 8,
        publicUrl: 'public',
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      getPublicUrl: jest.fn(),
      getReadUrl: jest.fn(async (key: string) => `signed:${key}`),
      health: jest.fn(),
    };
    service = new ProductMediaService(storage);
    mockPrisma.$transaction.mockImplementation(
      async (callback: (client: typeof mockPrisma) => unknown) => callback(mockPrisma),
    );
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'product-id', status: 'ACTIVE', archived_at: null },
    ]);
    mockPrisma.product.findFirst.mockResolvedValue(product);
    mockPrisma.productMedia.findMany.mockResolvedValue([]);
    mockPrisma.productMedia.findFirst.mockResolvedValue(null);
    mockPrisma.productMedia.aggregate.mockResolvedValue({ _max: { displayOrder: null } });
  });

  it('lists media with signed read URLs and uploads a first primary image safely', async () => {
    mockPrisma.productMedia.findMany.mockResolvedValue([media('media-id')]);
    await expect(service.listMedia(tenant(), 'menu-id', 'product-id')).resolves.toMatchObject({
      productId: 'product-id',
      media: [{ id: 'media-id', url: 'signed:media-id.png', isPrimary: true }],
    });

    mockPrisma.productMedia.create.mockResolvedValue(
      media('new-media', { storageKey: 'stored-key', originalName: 'dish.png', isPrimary: true }),
    );
    await expect(
      service.uploadMedia(tenant(), 'menu-id', 'product-id', {
        buffer: png,
        mimetype: 'image/png',
        originalname: 'folder/dish.png',
        size: png.byteLength,
      }),
    ).resolves.toMatchObject({
      id: 'new-media',
      originalName: 'dish.png',
      url: 'signed:stored-key',
    });
    expect(storage.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(
          /^product-media\/organization-id\/menu-id\/product-id\/.*\.png$/,
        ),
        contentLength: 8,
      }),
    );
    expect(mockPrisma.productMedia.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mediaType: 'IMAGE',
          contentType: 'image/png',
          isPrimary: true,
          displayOrder: 0,
        }),
      }),
    );
  });

  it('sets primary, removes storage and promotes the first remaining media', async () => {
    mockPrisma.productMedia.findFirst.mockResolvedValue(media('media-2', { isPrimary: false }));
    mockPrisma.productMedia.findMany.mockResolvedValueOnce([
      media('media-2', { isPrimary: true, displayOrder: 0 }),
    ]);
    await expect(
      service.setPrimary(tenant(), 'menu-id', 'product-id', 'media-2'),
    ).resolves.toMatchObject({ media: [{ isPrimary: true }] });
    expect(mockPrisma.productMedia.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPrimary: false } }),
    );

    mockPrisma.productMedia.findFirst.mockResolvedValue(
      media('media-1', { storageKey: 'media-1.png', isPrimary: true }),
    );
    mockPrisma.productMedia.findMany.mockResolvedValue([
      media('media-2', { isPrimary: false, displayOrder: 1 }),
    ]);
    await expect(
      service.removeMedia(tenant(), 'menu-id', 'product-id', 'media-1'),
    ).resolves.toMatchObject({ productId: 'product-id' });
    expect(storage.delete).toHaveBeenCalledWith('media-1.png');
    expect(mockPrisma.productMedia.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ displayOrder: 0, isPrimary: true }),
      }),
    );
  });

  it('reorders exactly all media and rejects duplicates or unknown ids', async () => {
    mockPrisma.productMedia.findMany
      .mockResolvedValueOnce([{ id: 'media-1' }, { id: 'media-2' }])
      .mockResolvedValueOnce([
        media('media-2', { displayOrder: 0 }),
        media('media-1', { displayOrder: 1 }),
      ]);
    await expect(
      service.reorderMedia(tenant(), 'menu-id', 'product-id', { mediaIds: ['media-2', 'media-1'] }),
    ).resolves.toMatchObject({ media: [{ id: 'media-2' }, { id: 'media-1' }] });
    expect(mockPrisma.productMedia.update).toHaveBeenCalledTimes(2);

    mockPrisma.productMedia.findMany.mockResolvedValueOnce([{ id: 'media-1' }, { id: 'media-2' }]);
    await expect(
      service.reorderMedia(tenant(), 'menu-id', 'product-id', { mediaIds: ['media-1', 'media-1'] }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_MEDIA_REORDER_INVALID' }),
    });
  });

  it('rejects members, archived or missing products and invalid file content before storage', async () => {
    await expect(
      service.uploadMedia(tenant('MEMBER'), 'menu-id', 'product-id', {
        buffer: png,
        mimetype: 'image/png',
        originalname: 'x.png',
        size: 8,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_MEDIA_MANAGEMENT_ACCESS_DENIED' }),
    });

    mockPrisma.product.findFirst.mockResolvedValue({ ...product, archivedAt: date });
    await expect(
      service.uploadMedia(tenant(), 'menu-id', 'product-id', {
        buffer: png,
        mimetype: 'image/png',
        originalname: 'x.png',
        size: 8,
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PRODUCT_ARCHIVED' }) });
    expect(storage.upload).not.toHaveBeenCalled();

    mockPrisma.product.findFirst.mockResolvedValue(null);
    await expect(service.listMedia(tenant(), 'menu-id', 'missing-product')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_NOT_FOUND' }),
    });
    mockPrisma.product.findFirst.mockResolvedValue(product);
    await expect(
      service.uploadMedia(tenant(), 'menu-id', 'product-id', {
        buffer: png,
        mimetype: 'application/pdf',
        originalname: 'x.pdf',
        size: 8,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_MEDIA_TYPE_INVALID' }),
    });
    await expect(
      service.uploadMedia(tenant(), 'menu-id', 'product-id', {
        buffer: new Uint8Array([1]),
        mimetype: 'image/png',
        originalname: 'x.png',
        size: 1,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_MEDIA_CONTENT_INVALID' }),
    });
    expect(storage.upload).not.toHaveBeenCalled();
  });
});
