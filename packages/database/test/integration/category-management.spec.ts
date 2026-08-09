import type { MembershipRole } from '@pratto/contracts';
import { PrismaClient } from '@prisma/client';

import { CatalogService } from '../../../../apps/api/src/modules/catalog/application/catalog.service';
import {
  clearDatabase,
  createMenu,
  createTenantFixture,
} from '../../src/testing';

const database = new PrismaClient();

function tenantContext(
  tenant: Awaited<ReturnType<typeof createTenantFixture>>,
  role: MembershipRole = 'OWNER',
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

describe('category management', () => {
  const service = new CatalogService();

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it('supports CRUD, status changes and tenant-scoped listing', async () => {
    const tenant = await createTenantFixture(database, { label: 'Categories' });
    const context = tenantContext(tenant);

    const created = await service.createCategory(context, tenant.menu.id, {
      name: ' Entradas ',
      description: 'Para começar',
    });
    expect(created).toMatchObject({
      menuId: tenant.menu.id,
      name: 'Entradas',
      description: 'Para começar',
      displayOrder: 0,
      status: 'ACTIVE',
      archivedAt: null,
    });

    const updated = await service.updateCategory(context, tenant.menu.id, created.id, {
      name: 'Petiscos',
      description: null,
    });
    expect(updated).toMatchObject({ name: 'Petiscos', description: null });

    await expect(service.deactivateCategory(context, tenant.menu.id, created.id)).resolves.toMatchObject({
      status: 'INACTIVE',
    });
    await expect(service.activateCategory(context, tenant.menu.id, created.id)).resolves.toMatchObject({
      status: 'ACTIVE',
    });

    await expect(service.listCategories(context, tenant.menu.id)).resolves.toMatchObject({
      menuId: tenant.menu.id,
      categories: [expect.objectContaining({ id: created.id, name: 'Petiscos' })],
    });
  });

  it('returns all editable menus and does not choose a target implicitly', async () => {
    const tenant = await createTenantFixture(database, { label: 'Explicit menu' });
    const secondMenu = await createMenu(database, {
      organizationId: tenant.organization.id,
      establishmentId: tenant.establishment.id,
      name: 'Menu secundário',
    });

    await expect(service.listMenusForEstablishment(tenantContext(tenant), tenant.establishment.id)).resolves.toMatchObject({
      establishmentId: tenant.establishment.id,
      menus: [
        expect.objectContaining({ id: tenant.menu.id }),
        expect.objectContaining({ id: secondMenu.id }),
      ],
    });
  });

  it('rejects duplicate names in the same editable menu, including normalized casing', async () => {
    const tenant = await createTenantFixture(database, { label: 'Duplicates' });
    const context = tenantContext(tenant);
    await service.createCategory(context, tenant.menu.id, { name: 'Bebidas' });

    await expect(
      service.createCategory(context, tenant.menu.id, { name: '  bebidas  ' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CATEGORY_NAME_ALREADY_IN_USE' }) });
  });

  it('keeps ordering contiguous after reorder and archive, while allowing the archived name to be reused', async () => {
    const tenant = await createTenantFixture(database, { label: 'Ordering' });
    const context = tenantContext(tenant);
    const first = await service.createCategory(context, tenant.menu.id, { name: 'Entradas' });
    const second = await service.createCategory(context, tenant.menu.id, { name: 'Pratos' });
    const third = await service.createCategory(context, tenant.menu.id, { name: 'Sobremesas' });

    const reordered = await service.reorderCategories(context, tenant.menu.id, {
      categoryIds: [third.id, first.id, second.id],
    });
    expect(reordered.categories.filter(({ archivedAt }) => !archivedAt).map(({ id, displayOrder }) => [id, displayOrder])).toEqual([
      [third.id, 0],
      [first.id, 1],
      [second.id, 2],
    ]);

    const archived = await service.archiveCategory(context, tenant.menu.id, first.id);
    expect(archived).toMatchObject({ status: 'INACTIVE', archivedAt: expect.any(String) });

    const afterArchive = await service.listCategories(context, tenant.menu.id);
    expect(afterArchive.categories.filter(({ archivedAt }) => !archivedAt).map(({ displayOrder }) => displayOrder)).toEqual([0, 1]);
    expect(afterArchive.categories.find(({ id }) => id === first.id)).toMatchObject({
      status: 'INACTIVE',
      archivedAt: expect.any(String),
    });

    const replacement = await service.createCategory(context, tenant.menu.id, { name: 'Entradas' });
    expect(replacement.displayOrder).toBe(2);

    const indexes = await database.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'pratto_test'
        AND tablename = 'categories'
        AND indexname = 'categories_menu_id_normalized_name_active_key'
    `;
    expect(indexes).toHaveLength(1);
  });

  it('rejects incomplete reorder payloads and mutations of archived categories', async () => {
    const tenant = await createTenantFixture(database, { label: 'Validation' });
    const context = tenantContext(tenant);
    const category = await service.createCategory(context, tenant.menu.id, { name: 'Entradas' });

    await expect(
      service.reorderCategories(context, tenant.menu.id, { categoryIds: [] }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CATEGORY_REORDER_INVALID' }) });
    await service.archiveCategory(context, tenant.menu.id, category.id);
    await expect(service.updateCategory(context, tenant.menu.id, category.id, { name: 'Outra' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CATEGORY_ARCHIVED' }),
    });
  });

  it('isolates menus between tenants and requires an administrative role for mutations', async () => {
    const tenantA = await createTenantFixture(database, { label: 'Tenant A' });
    const tenantB = await createTenantFixture(database, { label: 'Tenant B' });
    const categoryB = await service.createCategory(tenantContext(tenantB), tenantB.menu.id, {
      name: 'Categoria B',
    });

    await expect(service.listCategories(tenantContext(tenantA), tenantB.menu.id)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MENU_NOT_FOUND' }),
    });
    await expect(
      service.updateCategory(tenantContext(tenantA), tenantA.menu.id, categoryB.id, { name: 'Invasão' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }) });

    const memberContext = tenantContext(tenantA, 'MEMBER');
    await expect(
      service.createCategory(memberContext, tenantA.menu.id, { name: 'Sem permissão' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CATALOG_MANAGEMENT_ACCESS_DENIED' }),
    });
    await expect(service.listCategories(tenantContext(tenantA), tenantA.menu.id)).resolves.toMatchObject({
      menuId: tenantA.menu.id,
    });
  });
});
