import { PrismaClient } from '@prisma/client';

import { CatalogMenuSnapshotSource } from '../../../../apps/api/src/modules/catalog/application/catalog-menu-snapshot-source';
import { CatalogService } from '../../../../apps/api/src/modules/catalog/application/catalog.service';
import { MenuPublicationService } from '../../src/menu-publication';
import { clearDatabase, createMenu, createTenantFixture } from '../../src/testing';

const database = new PrismaClient();

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

describe('product management', () => {
  const service = new CatalogService();

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it('supports CRUD, category association, decimal prices, availability and status', async () => {
    const tenant = await createTenantFixture(database, { label: 'Products' });
    const context = tenantContext(tenant);
    const category = await service.createCategory(context, tenant.menu.id, { name: 'Lanches' });

    const created = await service.createProduct(context, tenant.menu.id, {
      categoryId: category.id,
      name: '  Clássico  ',
      description: 'Hambúrguer artesanal',
      price: '29.90',
      promotionalPrice: '24.50',
      ingredients: 'Carne e queijo',
      allergens: 'Glúten e leite',
      availability: 'AVAILABLE',
      featured: true,
    });
    expect(created).toMatchObject({
      menuId: tenant.menu.id,
      categoryId: category.id,
      name: 'Clássico',
      price: '29.90',
      promotionalPrice: '24.50',
      featured: true,
      status: 'ACTIVE',
      archivedAt: null,
      displayOrder: 0,
    });

    const stored = await database.product.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.price.toFixed(2)).toBe('29.90');
    expect(stored.promotionalPrice?.toFixed(2)).toBe('24.50');

    const updated = await service.updateProduct(context, tenant.menu.id, created.id, {
      name: 'Clássico especial',
      description: null,
      price: '31.00',
      promotionalPrice: '27.90',
      availability: 'TEMPORARILY_UNAVAILABLE',
      featured: false,
    });
    expect(updated).toMatchObject({
      name: 'Clássico especial',
      description: null,
      price: '31.00',
      promotionalPrice: '27.90',
      availability: 'TEMPORARILY_UNAVAILABLE',
      featured: false,
    });

    await expect(
      service.deactivateProduct(context, tenant.menu.id, created.id),
    ).resolves.toMatchObject({
      status: 'INACTIVE',
    });
    await expect(
      service.activateProduct(context, tenant.menu.id, created.id),
    ).resolves.toMatchObject({
      status: 'ACTIVE',
    });
    await expect(service.listProducts(context, tenant.menu.id)).resolves.toMatchObject({
      menuId: tenant.menu.id,
      products: [expect.objectContaining({ id: created.id, categoryId: category.id })],
    });
  });

  it('validates promotional prices without floating-point conversion', async () => {
    const tenant = await createTenantFixture(database, { label: 'Money' });
    const context = tenantContext(tenant);
    const category = await service.createCategory(context, tenant.menu.id, { name: 'Pratos' });

    await expect(
      service.createProduct(context, tenant.menu.id, {
        categoryId: category.id,
        name: 'Preço inválido',
        price: '10.00',
        promotionalPrice: '10.01',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROMOTIONAL_PRICE_INVALID' }),
    });

    await expect(
      service.createProduct(context, tenant.menu.id, {
        categoryId: category.id,
        name: 'Preço textual',
        price: '0.30',
        promotionalPrice: '0.10',
      }),
    ).resolves.toMatchObject({ price: '0.30', promotionalPrice: '0.10' });

    const column = await database.$queryRaw<
      Array<{ data_type: string; numeric_precision: number }>
    >`
      SELECT data_type, numeric_precision
      FROM information_schema.columns
      WHERE table_schema = 'pratto_test'
        AND table_name = 'products'
        AND column_name = 'price'
    `;
    expect(column).toEqual([{ data_type: 'numeric', numeric_precision: 10 }]);
  });

  it('requires a non-archived category from the same tenant and menu', async () => {
    const tenantA = await createTenantFixture(database, { label: 'Product tenant A' });
    const tenantB = await createTenantFixture(database, { label: 'Product tenant B' });
    const secondMenu = await createMenu(database, {
      organizationId: tenantA.organization.id,
      establishmentId: tenantA.establishment.id,
      name: 'Menu secundário',
    });
    const categoryA = await service.createCategory(tenantContext(tenantA), tenantA.menu.id, {
      name: 'A',
    });
    const categoryOtherMenu = await service.createCategory(tenantContext(tenantA), secondMenu.id, {
      name: 'Outro menu',
    });
    const categoryB = await service.createCategory(tenantContext(tenantB), tenantB.menu.id, {
      name: 'B',
    });

    await expect(
      service.createProduct(tenantContext(tenantA), tenantA.menu.id, {
        categoryId: categoryB.id,
        name: 'Invasão tenant',
        price: '10.00',
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }) });
    await expect(
      service.createProduct(tenantContext(tenantA), tenantA.menu.id, {
        categoryId: categoryOtherMenu.id,
        name: 'Invasão menu',
        price: '10.00',
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }) });

    await service.archiveCategory(tenantContext(tenantA), tenantA.menu.id, categoryA.id);
    await expect(
      service.createProduct(tenantContext(tenantA), tenantA.menu.id, {
        categoryId: categoryA.id,
        name: 'Categoria arquivada',
        price: '10.00',
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }) });
  });

  it('keeps product ordering contiguous after reorder and archive', async () => {
    const tenant = await createTenantFixture(database, { label: 'Product ordering' });
    const context = tenantContext(tenant);
    const category = await service.createCategory(context, tenant.menu.id, { name: 'Todos' });
    const input = (name: string) => ({ categoryId: category.id, name, price: '10.00' });
    const first = await service.createProduct(context, tenant.menu.id, input('Primeiro'));
    const second = await service.createProduct(context, tenant.menu.id, input('Segundo'));
    const third = await service.createProduct(context, tenant.menu.id, input('Terceiro'));

    const reordered = await service.reorderProducts(context, tenant.menu.id, {
      productIds: [third.id, first.id, second.id],
    });
    expect(
      reordered.products
        .filter(({ archivedAt }) => !archivedAt)
        .map(({ id, displayOrder }) => [id, displayOrder]),
    ).toEqual([
      [third.id, 0],
      [first.id, 1],
      [second.id, 2],
    ]);

    const archived = await service.archiveProduct(context, tenant.menu.id, first.id);
    expect(archived).toMatchObject({ status: 'INACTIVE', archivedAt: expect.any(String) });
    const afterArchive = await service.listProducts(context, tenant.menu.id);
    expect(
      afterArchive.products
        .filter(({ archivedAt }) => !archivedAt)
        .map(({ displayOrder }) => displayOrder),
    ).toEqual([0, 1]);
    expect(await database.product.count({ where: { id: first.id } })).toBe(1);
    await expect(
      service.updateProduct(context, tenant.menu.id, first.id, { name: 'Não pode' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_ARCHIVED' }),
    });
    await expect(
      service.reorderProducts(context, tenant.menu.id, { productIds: [] }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_REORDER_INVALID' }),
    });
  });

  it('isolates product reads and mutations by tenant and role', async () => {
    const tenantA = await createTenantFixture(database, { label: 'Product isolation A' });
    const tenantB = await createTenantFixture(database, { label: 'Product isolation B' });
    const categoryB = await service.createCategory(tenantContext(tenantB), tenantB.menu.id, {
      name: 'B',
    });
    const productB = await service.createProduct(tenantContext(tenantB), tenantB.menu.id, {
      categoryId: categoryB.id,
      name: 'Produto B',
      price: '12.00',
    });

    await expect(
      service.listProducts(tenantContext(tenantA), tenantB.menu.id),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MENU_NOT_FOUND' }),
    });
    await expect(
      service.updateProduct(tenantContext(tenantA), tenantA.menu.id, productB.id, {
        name: 'Invasão',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_NOT_FOUND' }),
    });
    await expect(
      service.createProduct(tenantContext(tenantA, 'MEMBER'), tenantA.menu.id, {
        categoryId: (
          await service.createCategory(tenantContext(tenantA), tenantA.menu.id, { name: 'A' })
        ).id,
        name: 'Sem permissão',
        price: '12.00',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CATALOG_MANAGEMENT_ACCESS_DENIED' }),
    });
  });

  it('includes editable products in a new snapshot and preserves previous versions', async () => {
    const tenant = await createTenantFixture(database, { label: 'Product snapshot' });
    const context = tenantContext(tenant);
    const category = await service.createCategory(context, tenant.menu.id, { name: 'Lanches' });
    const product = await service.createProduct(context, tenant.menu.id, {
      categoryId: category.id,
      name: 'Snapshot burger',
      description: 'Original',
      price: '25.90',
      promotionalPrice: null,
      ingredients: 'Carne',
      allergens: 'Leite',
      availability: 'AVAILABLE',
      featured: true,
    });
    const publicationService = new MenuPublicationService(
      database,
      new CatalogMenuSnapshotSource(),
    );
    const first = await publicationService.publish({
      menuId: tenant.menu.id,
      tenant: { organizationId: tenant.organization.id, userId: tenant.user.id },
      idempotencyKey: 'product-snapshot-1',
    });

    await service.updateProduct(context, tenant.menu.id, product.id, { description: 'Edited' });
    const second = await publicationService.publish({
      menuId: tenant.menu.id,
      tenant: { organizationId: tenant.organization.id, userId: tenant.user.id },
      idempotencyKey: 'product-snapshot-2',
    });

    expect(first.snapshot).toMatchObject({
      categories: [expect.objectContaining({ id: category.id, name: 'Lanches' })],
      products: [
        expect.objectContaining({
          id: product.id,
          categoryId: category.id,
          description: 'Original',
          price: '25.90',
        }),
      ],
    });
    expect(second.snapshot).toMatchObject({
      products: [expect.objectContaining({ id: product.id, description: 'Edited' })],
    });
    expect(first.snapshot).toMatchObject({
      products: [expect.objectContaining({ id: product.id, description: 'Original' })],
    });
  });
});
