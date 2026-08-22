import type { StorageService } from '@pratto/contracts';
import { LifecycleStatus, MenuStatus, PrismaClient, ProductAvailability } from '@prisma/client';

import { CatalogMenuSnapshotSource } from '../../../../apps/api/src/modules/catalog/application/catalog-menu-snapshot-source';
import { PublicMenuService } from '../../../../apps/api/src/modules/public-menu/application/public-menu.service';
import { MenuPublicationService } from '../../src/menu-publication';
import { clearDatabase, createMenu, createTenantFixture } from '../../src/testing';

const database = new PrismaClient();

function createStorage(): StorageService {
  return {
    upload: jest.fn(),
    delete: jest.fn(),
    getPublicUrl: jest.fn(),
    getReadUrl: jest.fn(async (key: string) => `signed:${key}`),
    health: jest.fn(),
  };
}

async function createPublishedCatalog(databaseClient: PrismaClient) {
  const tenant = await createTenantFixture(databaseClient, { label: 'Public menu' });
  const category = await databaseClient.category.create({
    data: {
      organizationId: tenant.organization.id,
      menuId: tenant.menu.id,
      name: 'Pratos',
      normalizedName: 'pratos',
    },
  });
  await databaseClient.product.createMany({
    data: [
      {
        organizationId: tenant.organization.id,
        menuId: tenant.menu.id,
        categoryId: category.id,
        name: 'Produto publicado',
        price: '29.90',
        availability: ProductAvailability.AVAILABLE,
      },
      {
        organizationId: tenant.organization.id,
        menuId: tenant.menu.id,
        categoryId: category.id,
        name: 'Produto indisponível',
        price: '30.00',
        availability: ProductAvailability.TEMPORARILY_UNAVAILABLE,
      },
      {
        organizationId: tenant.organization.id,
        menuId: tenant.menu.id,
        categoryId: category.id,
        name: 'Produto oculto',
        price: '10.00',
        availability: ProductAvailability.HIDDEN,
      },
    ],
  });
  const publication = await new MenuPublicationService(
    databaseClient,
    new CatalogMenuSnapshotSource(),
  ).publish({
    menuId: tenant.menu.id,
    tenant: { organizationId: tenant.organization.id, userId: tenant.user.id },
    idempotencyKey: 'public-menu-publication',
  });
  return { tenant, publication };
}

describe('public menu integration', () => {
  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it('returns not found for an unknown public identity', async () => {
    await expect(
      new PublicMenuService(createStorage()).getPage('public-id-does-not-exist', { limit: 6 }),
    ).rejects.toMatchObject({ code: 'PUBLIC_MENU_NOT_FOUND' });
  });

  it('serves only the active immutable publication and filters hidden products', async () => {
    const { tenant } = await createPublishedCatalog(database);
    const service = new PublicMenuService(createStorage());

    const beforeEdit = await service.getPage(tenant.establishment.publicId, { limit: 6 });
    await database.product.updateMany({
      where: { menuId: tenant.menu.id },
      data: { name: 'Catálogo editável atual' },
    });
    const afterEdit = await service.getPage(tenant.establishment.publicId, { limit: 6 });

    expect(beforeEdit.products.map((product) => product.name).sort()).toEqual([
      'Produto indisponível',
      'Produto publicado',
    ]);
    expect(afterEdit.products.map((product) => product.name).sort()).toEqual([
      'Produto indisponível',
      'Produto publicado',
    ]);
    expect(
      afterEdit.products.some((product) => product.availability === 'TEMPORARILY_UNAVAILABLE'),
    ).toBe(true);
  });

  it('returns a stable empty state when the establishment has no active publication', async () => {
    const tenant = await createTenantFixture(database, { label: 'Not published' });
    await expect(
      new PublicMenuService(createStorage()).getPage(tenant.establishment.publicId, { limit: 6 }),
    ).rejects.toMatchObject({ code: 'PUBLIC_MENU_NOT_PUBLISHED' });
  });

  it('does not expose suspended establishments or invalid publication snapshots', async () => {
    const { tenant, publication } = await createPublishedCatalog(database);
    const service = new PublicMenuService(createStorage());

    await database.establishment.update({
      where: { id: tenant.establishment.id },
      data: { status: LifecycleStatus.INACTIVE },
    });
    await expect(
      service.getPage(tenant.establishment.publicId, { limit: 6 }),
    ).rejects.toMatchObject({
      code: 'PUBLIC_MENU_SUSPENDED',
    });

    await database.establishment.update({
      where: { id: tenant.establishment.id },
      data: { status: LifecycleStatus.ACTIVE },
    });
    await database.$executeRawUnsafe(
      'ALTER TABLE "menu_publications" DISABLE TRIGGER "menu_publications_immutable_trigger"',
    );
    try {
      await database.menuPublication.update({
        where: { id: publication.id },
        data: { snapshot: { schemaVersion: 2 } },
      });
    } finally {
      await database.$executeRawUnsafe(
        'ALTER TABLE "menu_publications" ENABLE TRIGGER "menu_publications_immutable_trigger"',
      );
    }
    await expect(
      service.getPage(tenant.establishment.publicId, { limit: 6 }),
    ).rejects.toMatchObject({
      code: 'PUBLIC_MENU_SNAPSHOT_INVALID',
    });
  });

  it('rejects ambiguous public configuration instead of selecting a menu implicitly', async () => {
    const { tenant } = await createPublishedCatalog(database);
    const secondMenu = await createMenu(database, {
      organizationId: tenant.organization.id,
      establishmentId: tenant.establishment.id,
      status: MenuStatus.DRAFT,
      name: 'Menu alternativo',
    });
    await new MenuPublicationService(database, new CatalogMenuSnapshotSource()).publish({
      menuId: secondMenu.id,
      tenant: { organizationId: tenant.organization.id, userId: tenant.user.id },
      idempotencyKey: 'public-menu-publication-second',
    });

    await expect(
      new PublicMenuService(createStorage()).getPage(tenant.establishment.publicId, { limit: 6 }),
    ).rejects.toMatchObject({ code: 'PUBLIC_MENU_CONFIGURATION_INVALID' });
  });
});
