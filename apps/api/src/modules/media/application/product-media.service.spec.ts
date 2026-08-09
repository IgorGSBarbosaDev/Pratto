import type { StorageService } from '@pratto/contracts';

const mockFindFirstProduct = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@pratto/database', () => ({
  prisma: {
    product: { findFirst: mockFindFirstProduct },
    $transaction: mockTransaction,
  },
}));

import { ProductMediaService } from './product-media.service';

const tenant = {
  sessionId: 'session-id',
  userId: 'user-id',
  rawToken: 'token',
  expiresAt: new Date(),
  renewed: false,
  membershipId: 'membership-id',
  organizationId: 'organization-id',
  role: 'OWNER' as const,
  establishmentIds: ['establishment-id'],
};

const product = {
  id: 'product-id',
  organizationId: 'organization-id',
  menuId: 'menu-id',
  status: 'ACTIVE',
  archivedAt: null,
};

const file = {
  buffer: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  mimetype: 'image/png',
  originalname: 'produto.png',
  size: 8,
};

function createStorage(
  deleteImplementation: () => Promise<void> = async () => undefined,
): StorageService {
  return {
    upload: jest.fn().mockResolvedValue({
      key: 'product-media/organization-id/menu-id/product-id/object.png',
      contentType: 'image/png',
      contentLength: 8,
      publicUrl: 'http://storage.test/object.png',
    }),
    delete: jest.fn(deleteImplementation),
    getPublicUrl: jest.fn((key: string) => `http://storage.test/${key}`),
    getReadUrl: jest.fn((key: string) => Promise.resolve(`http://storage.test/signed/${key}`)),
    health: jest.fn(),
  };
}

describe('ProductMediaService partial failures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFirstProduct.mockResolvedValue(product);
    mockTransaction.mockImplementation(async (callback: (transaction: unknown) => unknown) =>
      callback({
        $queryRaw: jest
          .fn()
          .mockResolvedValue([{ id: product.id, status: 'ACTIVE', archived_at: null }]),
        productMedia: {
          aggregate: jest.fn().mockResolvedValue({ _max: { displayOrder: null } }),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockRejectedValue(new Error('database write failed')),
        },
      }),
    );
  });

  it('removes a newly uploaded object when the database write fails', async () => {
    const storage = createStorage();
    const service = new ProductMediaService(storage);

    await expect(service.uploadMedia(tenant, 'menu-id', 'product-id', file)).rejects.toThrow(
      'database write failed',
    );
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith(
      'product-media/organization-id/menu-id/product-id/object.png',
    );
  });

  it('keeps the database error when best-effort orphan cleanup also fails', async () => {
    const storage = createStorage(async () => {
      throw new Error('storage delete failed');
    });
    const service = new ProductMediaService(storage);

    await expect(service.uploadMedia(tenant, 'menu-id', 'product-id', file)).rejects.toThrow(
      'database write failed',
    );
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });
});
