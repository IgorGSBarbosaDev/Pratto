import type { TenantPrincipal } from '../../identity/domain/auth.types';

const mockPrisma = {
  menu: { findFirst: jest.fn(), findMany: jest.fn() },
  category: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  product: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

jest.mock('@pratto/database', () => ({ prisma: mockPrisma }));

import { CatalogService } from './catalog.service';

const tenant = (role: TenantPrincipal['role'] = 'OWNER'): TenantPrincipal => ({
  sessionId: 'session-id',
  userId: 'user-id',
  rawToken: 'token',
  expiresAt: new Date('2026-08-01T00:00:00.000Z'),
  renewed: false,
  membershipId: 'membership-id',
  organizationId: 'organization-id',
  role,
  establishmentIds: ['establishment-id'],
});

const menu = { id: 'menu-id', establishmentId: 'establishment-id', status: 'DRAFT' };
const date = new Date('2026-08-01T00:00:00.000Z');

function category(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: 'organization-id',
    menuId: 'menu-id',
    name: `Category ${id}`,
    description: null,
    displayOrder: 0,
    status: 'ACTIVE',
    archivedAt: null,
    createdAt: date,
    updatedAt: date,
    ...overrides,
  };
}

function product(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: 'organization-id',
    menuId: 'menu-id',
    categoryId: 'category-id',
    name: `Product ${id}`,
    description: null,
    price: '10.00',
    promotionalPrice: null,
    ingredients: null,
    allergens: null,
    availability: 'AVAILABLE',
    featured: false,
    status: 'ACTIVE',
    archivedAt: null,
    displayOrder: 0,
    createdAt: date,
    updatedAt: date,
    ...overrides,
  };
}

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogService();
    mockPrisma.$transaction.mockImplementation(
      async (callback: (client: typeof mockPrisma) => unknown) => callback(mockPrisma),
    );
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'menu-id', status: 'DRAFT', establishment_id: 'establishment-id' },
    ]);
    mockPrisma.menu.findFirst.mockResolvedValue(menu);
    mockPrisma.category.findMany.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([]);
  });

  it('lists categories, products and menus only through the tenant scope', async () => {
    mockPrisma.category.findMany.mockResolvedValue([category('category-id')]);
    mockPrisma.product.findMany.mockResolvedValue([product('product-id')]);
    mockPrisma.menu.findMany.mockResolvedValue([
      { id: 'menu-id', name: 'Principal', status: 'DRAFT' },
    ]);

    await expect(service.listCategories(tenant(), 'menu-id')).resolves.toMatchObject({
      menuId: 'menu-id',
      categories: [{ id: 'category-id', name: 'Category category-id' }],
    });
    await expect(service.listProducts(tenant(), 'menu-id')).resolves.toMatchObject({
      products: [{ id: 'product-id', price: '10.00' }],
    });
    await expect(service.listMenusForEstablishment(tenant(), 'establishment-id')).resolves.toEqual({
      establishmentId: 'establishment-id',
      menus: [{ id: 'menu-id', name: 'Principal', status: 'DRAFT' }],
    });
    expect(mockPrisma.menu.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'menu-id', organizationId: 'organization-id' },
      }),
    );
    expect(mockPrisma.menu.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          establishmentId: 'establishment-id',
          organizationId: 'organization-id',
        }),
      }),
    );
  });

  it('creates and updates categories with normalized text and decimal-safe ordering', async () => {
    mockPrisma.category.aggregate.mockResolvedValue({ _max: { displayOrder: 2 } });
    mockPrisma.category.create.mockResolvedValue(
      category('category-new', {
        name: 'Entradas quentes',
        description: 'Descrição',
        displayOrder: 3,
      }),
    );
    mockPrisma.category.findFirst.mockResolvedValue(category('category-id'));
    mockPrisma.category.update.mockResolvedValue(
      category('category-id', {
        name: 'Pratos principais',
        description: 'Atualizada',
      }),
    );

    await expect(
      service.createCategory(tenant(), 'menu-id', {
        name: '  Entradas   quentes ',
        description: ' Descrição ',
      }),
    ).resolves.toMatchObject({ name: 'Entradas quentes', displayOrder: 3 });
    expect(mockPrisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Entradas quentes',
          normalizedName: 'entradas quentes',
          description: 'Descrição',
          displayOrder: 3,
        }),
      }),
    );

    await expect(
      service.updateCategory(tenant(), 'menu-id', 'category-id', {
        name: '  Pratos principais ',
        description: ' Atualizada ',
      }),
    ).resolves.toMatchObject({ name: 'Pratos principais', description: 'Atualizada' });
    expect(mockPrisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Pratos principais',
          normalizedName: 'pratos principais',
          description: 'Atualizada',
        },
      }),
    );
  });

  it('covers category status, archive and complete reorder behavior', async () => {
    const first = category('category-1', { displayOrder: 0 });
    const second = category('category-2', { displayOrder: 1 });
    mockPrisma.category.findFirst.mockResolvedValue(first);
    mockPrisma.category.findMany
      .mockResolvedValueOnce([{ id: 'category-1' }, { id: 'category-2' }])
      .mockResolvedValueOnce([second, first])
      .mockResolvedValueOnce([]);
    mockPrisma.category.update.mockResolvedValue(category('category-1', { status: 'INACTIVE' }));

    await expect(
      service.deactivateCategory(tenant(), 'menu-id', 'category-1'),
    ).resolves.toMatchObject({
      status: 'INACTIVE',
    });
    await expect(
      service.reorderCategories(tenant(), 'menu-id', {
        categoryIds: ['category-2', 'category-1'],
      }),
    ).resolves.toMatchObject({ categories: [{ id: 'category-2' }, { id: 'category-1' }] });

    mockPrisma.category.findFirst.mockResolvedValue(first);
    mockPrisma.category.findMany.mockResolvedValue([{ id: 'category-2' }]);
    mockPrisma.category.update.mockResolvedValue(
      category('category-1', {
        archivedAt: new Date('2026-08-02T00:00:00.000Z'),
        status: 'INACTIVE',
      }),
    );
    await expect(service.archiveCategory(tenant(), 'menu-id', 'category-1')).resolves.toMatchObject(
      {
        status: 'INACTIVE',
        archivedAt: '2026-08-02T00:00:00.000Z',
      },
    );

    await expect(
      service.reorderCategories(tenant(), 'menu-id', {
        categoryIds: ['category-2', 'category-2'],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CATEGORY_REORDER_INVALID' }),
    });
  });

  it('creates and updates products while preserving money and promotion rules', async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: 'category-id' });
    mockPrisma.product.aggregate.mockResolvedValue({ _max: { displayOrder: 4 } });
    mockPrisma.product.create.mockResolvedValue(
      product('product-new', {
        name: 'Produto novo',
        price: '12.50',
        promotionalPrice: '10.00',
        displayOrder: 5,
      }),
    );
    mockPrisma.product.findFirst.mockResolvedValue(product('product-id'));
    mockPrisma.product.update.mockResolvedValue(
      product('product-id', {
        name: 'Produto atualizado',
        price: '20.00',
        promotionalPrice: '18.00',
      }),
    );

    await expect(
      service.createProduct(tenant(), 'menu-id', {
        categoryId: 'category-id',
        name: ' Produto novo ',
        price: '12.5',
        promotionalPrice: '10',
      }),
    ).resolves.toMatchObject({ name: 'Produto novo', price: '12.50', promotionalPrice: '10.00' });
    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          price: '12.50',
          promotionalPrice: '10.00',
          displayOrder: 5,
        }),
      }),
    );

    await expect(
      service.updateProduct(tenant(), 'menu-id', 'product-id', {
        name: ' Produto atualizado ',
        price: '20',
        promotionalPrice: '18',
      }),
    ).resolves.toMatchObject({ name: 'Produto atualizado', price: '20.00' });

    await expect(
      service.createProduct(tenant(), 'menu-id', {
        categoryId: 'category-id',
        name: 'Inválido',
        price: '10',
        promotionalPrice: '10.01',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROMOTIONAL_PRICE_INVALID' }),
    });
    expect(mockPrisma.product.create).toHaveBeenCalledTimes(1);
  });

  it('covers product status, archive, reorder and menu access failures', async () => {
    mockPrisma.product.findFirst.mockResolvedValue(product('product-id'));
    mockPrisma.product.update.mockResolvedValue(product('product-id', { status: 'INACTIVE' }));
    await expect(
      service.deactivateProduct(tenant(), 'menu-id', 'product-id'),
    ).resolves.toMatchObject({
      status: 'INACTIVE',
    });

    mockPrisma.product.findMany
      .mockResolvedValueOnce([{ id: 'product-1' }, { id: 'product-2' }])
      .mockResolvedValueOnce([
        product('product-2', { displayOrder: 0 }),
        product('product-1', { displayOrder: 1 }),
      ])
      .mockResolvedValueOnce([]);
    await expect(
      service.reorderProducts(tenant(), 'menu-id', {
        productIds: ['product-2', 'product-1'],
      }),
    ).resolves.toMatchObject({ products: [{ id: 'product-2' }, { id: 'product-1' }] });

    mockPrisma.product.findFirst.mockResolvedValue(product('product-id'));
    mockPrisma.product.update.mockResolvedValue(
      product('product-id', {
        status: 'INACTIVE',
        archivedAt: new Date('2026-08-02T00:00:00.000Z'),
      }),
    );
    mockPrisma.product.findMany.mockResolvedValue([]);
    await expect(service.archiveProduct(tenant(), 'menu-id', 'product-id')).resolves.toMatchObject({
      archivedAt: '2026-08-02T00:00:00.000Z',
    });

    await expect(
      service.listMenusForEstablishment(tenant(), 'other-establishment'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MENU_NOT_FOUND' }),
    });
    await expect(
      service.createCategory(tenant('MEMBER'), 'menu-id', { name: 'Blocked' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CATALOG_MANAGEMENT_ACCESS_DENIED' }),
    });
  });

  it('rejects archived or missing resources and duplicate category names with stable errors', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'menu-id', status: 'ARCHIVED', establishment_id: 'establishment-id' },
    ]);
    await expect(
      service.createCategory(tenant(), 'menu-id', { name: 'Blocked' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MENU_ARCHIVED' }),
    });

    mockPrisma.$queryRaw.mockResolvedValue([]);
    await expect(
      service.createProduct(tenant(), 'menu-id', {
        categoryId: 'missing',
        name: 'Produto',
        price: '10',
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'MENU_NOT_FOUND' }) });

    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'menu-id', status: 'DRAFT', establishment_id: 'establishment-id' },
    ]);
    mockPrisma.category.aggregate.mockResolvedValue({ _max: { displayOrder: null } });
    mockPrisma.category.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.createCategory(tenant(), 'menu-id', { name: 'Duplicada' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CATEGORY_NAME_ALREADY_IN_USE' }),
    });
  });
});
