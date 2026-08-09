import { HttpStatus } from '@nestjs/common';
import type { CategoryListResponse, CategoryResponse } from '@pratto/contracts';

import type { CatalogService } from '../application/catalog.service';

import { CatalogController } from './catalog.controller';

const tenant = {
  organizationId: 'organization-a',
  role: 'OWNER',
  establishmentIds: ['11111111-1111-4111-8111-111111111111'],
} as never;

const category = {
  id: '22222222-2222-4222-8222-222222222222',
  menuId: '33333333-3333-4333-8333-333333333333',
  name: 'Entradas',
  description: null,
  displayOrder: 0,
  status: 'ACTIVE',
  archivedAt: null,
  createdAt: '2026-08-08T00:00:00.000Z',
  updatedAt: '2026-08-08T00:00:00.000Z',
} as CategoryResponse;

const list = { menuId: category.menuId, categories: [category] } as CategoryListResponse;

describe('CatalogController', () => {
  it('passes tenant, menu and validated creation input to the service', async () => {
    const createCategory = jest.fn().mockResolvedValue(category);
    const controller = new CatalogController({ createCategory } as unknown as CatalogService);

    await expect(
      controller.createCategory(
        category.menuId,
        { name: 'Entradas', description: 'Para começar' },
        { tenant } as never,
      ),
    ).resolves.toBe(category);
    expect(createCategory).toHaveBeenCalledWith(tenant, category.menuId, {
      name: 'Entradas',
      description: 'Para começar',
    });
  });

  it('lists menus explicitly instead of resolving a category target implicitly', async () => {
    const listMenusForEstablishment = jest.fn().mockResolvedValue({
      establishmentId: '11111111-1111-4111-8111-111111111111',
      menus: [{ id: category.menuId, name: 'Menu principal', status: 'DRAFT' }],
    });
    const controller = new CatalogController({ listMenusForEstablishment } as unknown as CatalogService);

    await expect(
      controller.listEstablishmentMenus('11111111-1111-4111-8111-111111111111', { tenant } as never),
    ).resolves.toEqual(expect.objectContaining({ menus: expect.any(Array) }));
    expect(listMenusForEstablishment).toHaveBeenCalledWith(
      tenant,
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('rejects malformed identifiers and unknown body fields before the service', () => {
    const service = { updateCategory: jest.fn() } as unknown as CatalogService;
    const controller = new CatalogController(service);

    expect(() =>
      controller.updateCategory('not-an-uuid', category.id, { name: 'Nova' }, { tenant } as never),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ statusCode: HttpStatus.BAD_REQUEST }),
      }),
    );
    expect(() =>
      controller.updateCategory(category.menuId, category.id, { unexpected: true }, { tenant } as never),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      }),
    );
    expect(service.updateCategory).not.toHaveBeenCalled();
  });

  it('passes reorder and archive operations to the tenant-scoped service', async () => {
    const reorderCategories = jest.fn().mockResolvedValue(list);
    const archiveCategory = jest.fn().mockResolvedValue(category);
    const controller = new CatalogController({ reorderCategories, archiveCategory } as unknown as CatalogService);

    await expect(
      controller.reorderCategories(category.menuId, { categoryIds: [category.id] }, { tenant } as never),
    ).resolves.toBe(list);
    await expect(
      controller.archiveCategory(category.menuId, category.id, { tenant } as never),
    ).resolves.toBe(category);
    expect(reorderCategories).toHaveBeenCalledWith(tenant, category.menuId, {
      categoryIds: [category.id],
    });
    expect(archiveCategory).toHaveBeenCalledWith(tenant, category.menuId, category.id);
  });
});
