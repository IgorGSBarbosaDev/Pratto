import { HttpStatus } from '@nestjs/common';
import type {
  CategoryListResponse,
  CategoryResponse,
  ProductListResponse,
  ProductResponse,
} from '@pratto/contracts';

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
const product = {
  id: '44444444-4444-4444-8444-444444444444',
  menuId: category.menuId,
  categoryId: category.id,
  name: 'Clássico',
  description: null,
  price: '19.90',
  promotionalPrice: null,
  ingredients: null,
  allergens: null,
  availability: 'AVAILABLE',
  featured: false,
  status: 'ACTIVE',
  archivedAt: null,
  displayOrder: 0,
  createdAt: '2026-08-08T00:00:00.000Z',
  updatedAt: '2026-08-08T00:00:00.000Z',
} as ProductResponse;
const productList = { menuId: category.menuId, products: [product] } as ProductListResponse;

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

  it('passes validated product input with the explicit menu and tenant', async () => {
    const createProduct = jest.fn().mockResolvedValue(product);
    const controller = new CatalogController({ createProduct } as unknown as CatalogService);

    await expect(
      controller.createProduct(
        category.menuId,
        {
          categoryId: category.id,
          name: 'Clássico',
          price: '19.9',
          promotionalPrice: '17.90',
          availability: 'AVAILABLE',
          featured: true,
        },
        { tenant } as never,
      ),
    ).resolves.toBe(product);
    expect(createProduct).toHaveBeenCalledWith(tenant, category.menuId, {
      categoryId: category.id,
      name: 'Clássico',
      price: '19.90',
      promotionalPrice: '17.90',
      availability: 'AVAILABLE',
      featured: true,
    });
  });

  it('rejects floating-point prices and invalid promotional prices at the API boundary', () => {
    const createProduct = jest.fn();
    const controller = new CatalogController({ createProduct } as unknown as CatalogService);

    expect(() =>
      controller.createProduct(
        category.menuId,
        { categoryId: category.id, name: 'Produto', price: 19.9 },
        { tenant } as never,
      ),
    ).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'VALIDATION_ERROR' }) }),
    );
    expect(() =>
      controller.createProduct(
        category.menuId,
        { categoryId: category.id, name: 'Produto', price: '19.90', promotionalPrice: '20.00' },
        { tenant } as never,
      ),
    ).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'VALIDATION_ERROR' }) }),
    );
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('lists menus explicitly instead of resolving a category target implicitly', async () => {
    const listMenusForEstablishment = jest.fn().mockResolvedValue({
      establishmentId: '11111111-1111-4111-8111-111111111111',
      menus: [{ id: category.menuId, name: 'Menu principal', status: 'DRAFT' }],
    });
    const controller = new CatalogController({
      listMenusForEstablishment,
    } as unknown as CatalogService);

    await expect(
      controller.listEstablishmentMenus('11111111-1111-4111-8111-111111111111', {
        tenant,
      } as never),
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
      controller.updateCategory(category.menuId, category.id, { unexpected: true }, {
        tenant,
      } as never),
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
    const controller = new CatalogController({
      reorderCategories,
      archiveCategory,
    } as unknown as CatalogService);

    await expect(
      controller.reorderCategories(category.menuId, { categoryIds: [category.id] }, {
        tenant,
      } as never),
    ).resolves.toBe(list);
    await expect(
      controller.archiveCategory(category.menuId, category.id, { tenant } as never),
    ).resolves.toBe(category);
    expect(reorderCategories).toHaveBeenCalledWith(tenant, category.menuId, {
      categoryIds: [category.id],
    });
    expect(archiveCategory).toHaveBeenCalledWith(tenant, category.menuId, category.id);
  });

  it('validates product update and delegates product ordering and archive', async () => {
    const updateProduct = jest.fn().mockResolvedValue(product);
    const reorderProducts = jest.fn().mockResolvedValue(productList);
    const archiveProduct = jest.fn().mockResolvedValue(product);
    const service = { updateProduct, reorderProducts, archiveProduct } as unknown as CatalogService;
    const controller = new CatalogController(service);

    await expect(
      controller.updateProduct(category.menuId, product.id, { price: '20.00' }, {
        tenant,
      } as never),
    ).resolves.toBe(product);
    await expect(
      controller.reorderProducts(category.menuId, { productIds: [product.id] }, {
        tenant,
      } as never),
    ).resolves.toBe(productList);
    await expect(
      controller.archiveProduct(category.menuId, product.id, { tenant } as never),
    ).resolves.toBe(product);
    expect(updateProduct).toHaveBeenCalledWith(tenant, category.menuId, product.id, {
      price: '20.00',
    });
    expect(reorderProducts).toHaveBeenCalledWith(tenant, category.menuId, {
      productIds: [product.id],
    });
    expect(archiveProduct).toHaveBeenCalledWith(tenant, category.menuId, product.id);
  });
});
