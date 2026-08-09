import type { ProductMediaResponse, StorageService } from '@pratto/contracts';
import { PrismaClient } from '@prisma/client';

import { CatalogMenuSnapshotSource } from '../../../../apps/api/src/modules/catalog/application/catalog-menu-snapshot-source';
import { CatalogService } from '../../../../apps/api/src/modules/catalog/application/catalog.service';
import {
  MAX_PRODUCT_IMAGE_SIZE_BYTES,
  ProductMediaService,
  type ProductMediaUploadFile,
} from '../../../../apps/api/src/modules/media/application/product-media.service';
import { MenuPublicationService } from '../../src/menu-publication';
import { clearDatabase, createTenantFixture } from '../../src/testing';

const database = new PrismaClient();
const catalog = new CatalogService();

function tenantContext(
  tenant: Awaited<ReturnType<typeof createTenantFixture>>,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER',
) {
  return {
    sessionId: 'session-id',
    userId: tenant.user.id,
    rawToken: 'raw-token',
    expiresAt: new Date(Date.now() + 60_000),
    renewed: false,
    membershipId: tenant.membership.id,
    organizationId: tenant.organization.id,
    role,
    establishmentIds: [tenant.establishment.id],
  };
}

function pngFile(name = 'produto.png'): ProductMediaUploadFile {
  const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return { buffer, mimetype: 'image/png', originalname: name, size: buffer.byteLength };
}

function mp4File(name = 'produto.mp4'): ProductMediaUploadFile {
  const buffer = new Uint8Array(12);
  buffer.set([0x00, 0x00, 0x00, 0x18], 0);
  buffer.set([0x66, 0x74, 0x79, 0x70], 4);
  return { buffer, mimetype: 'video/mp4', originalname: name, size: buffer.byteLength };
}

function createStorage(): StorageService {
  return {
    upload: jest.fn(async (input) => ({
      key: input.key,
      contentType: input.contentType,
      contentLength: input.contentLength,
      publicUrl: `http://storage.test/${input.key}`,
    })),
    delete: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest.fn((key: string) => `http://storage.test/${key}`),
    getReadUrl: jest.fn((key: string) => Promise.resolve(`http://storage.test/signed/${key}`)),
    health: jest.fn(),
  };
}

async function createProduct(tenant: Awaited<ReturnType<typeof createTenantFixture>>) {
  const context = tenantContext(tenant);
  const category = await catalog.createCategory(context, tenant.menu.id, { name: 'Lanches' });
  const product = await catalog.createProduct(context, tenant.menu.id, {
    categoryId: category.id,
    name: 'Produto com mídia',
    price: '10.00',
  });
  return { context, product };
}

describe('product media management', () => {
  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it('uploads images and videos to storage with a primary item and tenant-scoped response', async () => {
    const tenant = await createTenantFixture(database, { label: 'Media upload' });
    const { context, product } = await createProduct(tenant);
    const storage = createStorage();
    const service = new ProductMediaService(storage);

    const image = await service.uploadMedia(context, tenant.menu.id, product.id, pngFile());
    const video = await service.uploadMedia(context, tenant.menu.id, product.id, mp4File());

    expect(image).toMatchObject<ProductMediaResponse>({
      productId: product.id,
      mediaType: 'IMAGE',
      contentType: 'image/png',
      originalName: 'produto.png',
      sizeBytes: 8,
      displayOrder: 0,
      isPrimary: true,
      url: expect.stringContaining('/signed/product-media/'),
    });
    expect(video).toMatchObject({ mediaType: 'VIDEO', displayOrder: 1, isPrimary: false });
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(storage.getReadUrl).toHaveBeenCalledTimes(2);
    await expect(service.listMedia(context, tenant.menu.id, product.id)).resolves.toMatchObject({
      media: [{ id: image.id }, { id: video.id }],
    });
    await expect(
      database.productMedia.findMany({ where: { organizationId: tenant.organization.id } }),
    ).resolves.toHaveLength(2);
  });

  it('supports primary selection, complete reordering and safe removal with promotion', async () => {
    const tenant = await createTenantFixture(database, { label: 'Media operations' });
    const { context, product } = await createProduct(tenant);
    const storage = createStorage();
    const service = new ProductMediaService(storage);
    const first = await service.uploadMedia(
      context,
      tenant.menu.id,
      product.id,
      pngFile('first.png'),
    );
    const second = await service.uploadMedia(
      context,
      tenant.menu.id,
      product.id,
      pngFile('second.png'),
    );
    const third = await service.uploadMedia(
      context,
      tenant.menu.id,
      product.id,
      pngFile('third.png'),
    );

    const primaryResult = await service.setPrimary(context, tenant.menu.id, product.id, second.id);
    expect(primaryResult.media.find(({ id }) => id === first.id)?.isPrimary).toBe(false);
    expect(primaryResult.media.find(({ id }) => id === second.id)?.isPrimary).toBe(true);
    const reordered = await service.reorderMedia(context, tenant.menu.id, product.id, {
      mediaIds: [third.id, second.id, first.id],
    });
    expect(reordered.media.map(({ id, displayOrder }) => [id, displayOrder])).toEqual([
      [third.id, 0],
      [second.id, 1],
      [first.id, 2],
    ]);

    const secondRecord = await database.productMedia.findUniqueOrThrow({
      where: { id: second.id },
    });
    const afterRemoval = await service.removeMedia(context, tenant.menu.id, product.id, second.id);
    expect(
      afterRemoval.media.map(({ id, displayOrder, isPrimary }) => [id, displayOrder, isPrimary]),
    ).toEqual([
      [third.id, 0, true],
      [first.id, 1, false],
    ]);
    expect(storage.delete).toHaveBeenCalledWith(secondRecord.storageKey);
    expect(await database.productMedia.count({ where: { id: second.id } })).toBe(0);
  });

  it('rejects invalid MIME, extension, signature and size before touching storage', async () => {
    const tenant = await createTenantFixture(database, { label: 'Media validation' });
    const { context, product } = await createProduct(tenant);
    const storage = createStorage();
    const service = new ProductMediaService(storage);

    await expect(
      service.uploadMedia(context, tenant.menu.id, product.id, {
        ...pngFile('malware.pdf'),
        mimetype: 'application/pdf',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_MEDIA_TYPE_INVALID' }),
    });
    await expect(
      service.uploadMedia(context, tenant.menu.id, product.id, pngFile('produto.jpg')),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_MEDIA_EXTENSION_INVALID' }),
    });
    await expect(
      service.uploadMedia(context, tenant.menu.id, product.id, {
        ...pngFile(),
        buffer: new Uint8Array([1, 2, 3, 4]),
        size: 4,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_MEDIA_CONTENT_INVALID' }),
    });
    await expect(
      service.uploadMedia(context, tenant.menu.id, product.id, {
        ...pngFile(),
        buffer: new Uint8Array(MAX_PRODUCT_IMAGE_SIZE_BYTES + 1),
        size: MAX_PRODUCT_IMAGE_SIZE_BYTES + 1,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_MEDIA_SIZE_INVALID' }),
    });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('enforces role, tenant and menu isolation', async () => {
    const tenantA = await createTenantFixture(database, { label: 'Media tenant A' });
    const tenantB = await createTenantFixture(database, { label: 'Media tenant B' });
    const productB = await createProduct(tenantB);
    const storage = createStorage();
    const service = new ProductMediaService(storage);

    await expect(
      service.uploadMedia(
        tenantContext(tenantA, 'MEMBER'),
        tenantA.menu.id,
        productB.product.id,
        pngFile(),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_MEDIA_MANAGEMENT_ACCESS_DENIED' }),
    });
    await expect(
      service.listMedia(tenantContext(tenantA), tenantB.menu.id, productB.product.id),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PRODUCT_NOT_FOUND' }) });
    await expect(
      service.uploadMedia(tenantContext(tenantA), tenantA.menu.id, productB.product.id, pngFile()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PRODUCT_NOT_FOUND' }) });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('includes media in a new publication while preserving the previous snapshot', async () => {
    const tenant = await createTenantFixture(database, { label: 'Media snapshot' });
    const { context, product } = await createProduct(tenant);
    const storage = createStorage();
    const mediaService = new ProductMediaService(storage);
    const image = await mediaService.uploadMedia(context, tenant.menu.id, product.id, pngFile());
    const publicationService = new MenuPublicationService(
      database,
      new CatalogMenuSnapshotSource(),
    );

    const first = await publicationService.publish({
      menuId: tenant.menu.id,
      tenant: { organizationId: tenant.organization.id, userId: tenant.user.id },
      idempotencyKey: 'media-snapshot-1',
    });
    await mediaService.uploadMedia(context, tenant.menu.id, product.id, pngFile('second.png'));
    const second = await publicationService.publish({
      menuId: tenant.menu.id,
      tenant: { organizationId: tenant.organization.id, userId: tenant.user.id },
      idempotencyKey: 'media-snapshot-2',
    });

    expect(first.snapshot).toMatchObject({
      schemaVersion: 2,
      media: [expect.objectContaining({ id: image.id, productId: product.id, isPrimary: true })],
    });
    expect(second.snapshot).toMatchObject({
      media: [
        expect.objectContaining({ id: image.id }),
        expect.objectContaining({ contentType: 'image/png' }),
      ],
    });
    expect(first.snapshot).toMatchObject({ media: [expect.objectContaining({ id: image.id })] });
    expect((first.snapshot as { media: unknown[] }).media).toHaveLength(1);
  });
});
