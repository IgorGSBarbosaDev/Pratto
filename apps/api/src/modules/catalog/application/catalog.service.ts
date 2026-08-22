import { HttpStatus, Injectable } from '@nestjs/common';
import { hasPermission, Permission } from '@pratto/contracts';
import type {
  CategoryListResponse,
  CategoryResponse,
  CategoryStatus,
  MenuListResponse,
  ProductAvailability,
  ProductCreateInput,
  ProductListResponse,
  ProductReorderInput,
  ProductResponse,
  ProductStatus,
  ProductUpdateInput,
} from '@pratto/contracts';
import { prisma } from '@pratto/database';
import type { Prisma } from '@pratto/database';
import type {
  CategoryCreateInput,
  CategoryReorderInput,
  CategoryUpdateInput,
} from '@pratto/validation';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { TenantPrincipal } from '../../identity/domain/auth.types';

const categorySelect = {
  id: true,
  organizationId: true,
  menuId: true,
  name: true,
  description: true,
  displayOrder: true,
  status: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

type CategoryRecord = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;
const productSelect = {
  id: true,
  organizationId: true,
  menuId: true,
  categoryId: true,
  name: true,
  description: true,
  price: true,
  promotionalPrice: true,
  ingredients: true,
  allergens: true,
  availability: true,
  featured: true,
  status: true,
  archivedAt: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

type ProductRecord = Prisma.ProductGetPayload<{ select: typeof productSelect }>;
type DatabaseClient = Prisma.TransactionClient | typeof prisma;

@Injectable()
export class CatalogService {
  private readonly database = prisma;

  async listCategories(tenant: TenantPrincipal, menuId: string): Promise<CategoryListResponse> {
    const menu = await this.findMenu(tenant, menuId);
    return this.listForMenu(tenant.organizationId, menu.id);
  }

  async listProducts(tenant: TenantPrincipal, menuId: string): Promise<ProductListResponse> {
    const menu = await this.findMenu(tenant, menuId);
    return this.listProductsForMenu(tenant.organizationId, menu.id);
  }

  async createProduct(
    tenant: TenantPrincipal,
    menuId: string,
    input: ProductCreateInput,
  ): Promise<ProductResponse> {
    this.assertCanManage(tenant);
    return this.database.$transaction(async (transaction) => {
      await this.lockEditableMenu(transaction, tenant, menuId);
      await this.findProductCategory(transaction, tenant.organizationId, menuId, input.categoryId);

      const price = cleanMoney(input.price, 'PRODUCT_PRICE_INVALID');
      const promotionalPrice = cleanOptionalMoney(input.promotionalPrice);
      assertPromotionalPrice(price, promotionalPrice);
      const latest = await transaction.product.aggregate({
        where: { organizationId: tenant.organizationId, menuId, archivedAt: null },
        _max: { displayOrder: true },
      });

      const created = await transaction.product.create({
        data: {
          organizationId: tenant.organizationId,
          menuId,
          categoryId: input.categoryId,
          name: cleanProductName(input.name),
          description: cleanProductText(input.description),
          price,
          promotionalPrice,
          ingredients: cleanProductText(input.ingredients),
          allergens: cleanProductText(input.allergens),
          availability: input.availability ?? 'AVAILABLE',
          featured: input.featured ?? false,
          displayOrder: (latest._max.displayOrder ?? -1) + 1,
        },
        select: productSelect,
      });
      return this.toProductResponse(created);
    });
  }

  async updateProduct(
    tenant: TenantPrincipal,
    menuId: string,
    productId: string,
    input: ProductUpdateInput,
  ): Promise<ProductResponse> {
    this.assertCanManage(tenant);
    return this.database.$transaction(async (transaction) => {
      await this.lockEditableMenu(transaction, tenant, menuId);
      const current = await this.findProduct(transaction, tenant.organizationId, menuId, productId);
      this.assertProductNotArchived(current);
      if (Object.keys(input).length === 0) return this.toProductResponse(current);

      if (input.categoryId !== undefined) {
        await this.findProductCategory(
          transaction,
          tenant.organizationId,
          menuId,
          input.categoryId,
          input.categoryId === current.categoryId,
        );
      }
      const price =
        input.price === undefined
          ? formatMoney(current.price)
          : cleanMoney(input.price, 'PRODUCT_PRICE_INVALID');
      const promotionalPrice =
        input.promotionalPrice === undefined
          ? current.promotionalPrice === null
            ? null
            : formatMoney(current.promotionalPrice)
          : cleanOptionalMoney(input.promotionalPrice);
      assertPromotionalPrice(price, promotionalPrice);

      const data: Prisma.ProductUpdateInput = {};
      if (input.categoryId !== undefined)
        data.category = {
          connect: {
            id_organizationId_menuId: {
              id: input.categoryId,
              organizationId: tenant.organizationId,
              menuId,
            },
          },
        };
      if (input.name !== undefined) data.name = cleanProductName(input.name);
      if (input.description !== undefined) data.description = cleanProductText(input.description);
      if (input.price !== undefined) data.price = price;
      if (input.promotionalPrice !== undefined) data.promotionalPrice = promotionalPrice;
      if (input.ingredients !== undefined) data.ingredients = cleanProductText(input.ingredients);
      if (input.allergens !== undefined) data.allergens = cleanProductText(input.allergens);
      if (input.availability !== undefined) data.availability = input.availability;
      if (input.featured !== undefined) data.featured = input.featured;

      const updated = await transaction.product.update({
        where: { id_organizationId: { id: productId, organizationId: tenant.organizationId } },
        data,
        select: productSelect,
      });
      return this.toProductResponse(updated);
    });
  }

  activateProduct(
    tenant: TenantPrincipal,
    menuId: string,
    productId: string,
  ): Promise<ProductResponse> {
    return this.changeProductStatus(tenant, menuId, productId, 'ACTIVE');
  }

  deactivateProduct(
    tenant: TenantPrincipal,
    menuId: string,
    productId: string,
  ): Promise<ProductResponse> {
    return this.changeProductStatus(tenant, menuId, productId, 'INACTIVE');
  }

  async archiveProduct(
    tenant: TenantPrincipal,
    menuId: string,
    productId: string,
  ): Promise<ProductResponse> {
    this.assertCanManage(tenant);
    return this.database.$transaction(async (transaction) => {
      await this.lockEditableMenu(transaction, tenant, menuId);
      const current = await this.findProduct(transaction, tenant.organizationId, menuId, productId);
      this.assertProductNotArchived(current);
      const archived = await transaction.product.update({
        where: { id_organizationId: { id: productId, organizationId: tenant.organizationId } },
        data: { status: 'INACTIVE', archivedAt: new Date() },
        select: productSelect,
      });
      await this.normalizeProductOrders(transaction, tenant.organizationId, menuId);
      return this.toProductResponse(archived);
    });
  }

  async reorderProducts(
    tenant: TenantPrincipal,
    menuId: string,
    input: ProductReorderInput,
  ): Promise<ProductListResponse> {
    this.assertCanManage(tenant);
    return this.database.$transaction(async (transaction) => {
      await this.lockEditableMenu(transaction, tenant, menuId);
      const products = await transaction.product.findMany({
        where: { organizationId: tenant.organizationId, menuId, archivedAt: null },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: productSelect,
      });
      this.assertCompleteProductReorder(input, products);

      const byId = new Map(products.map((product) => [product.id, product]));
      for (const [displayOrder, productId] of input.productIds.entries()) {
        if (!byId.has(productId)) this.invalidProductReorder();
        await transaction.product.update({
          where: { id_organizationId: { id: productId, organizationId: tenant.organizationId } },
          data: { displayOrder },
        });
      }
      return this.listProductsForMenuWithClient(transaction, tenant.organizationId, menuId);
    });
  }

  async listMenusForEstablishment(
    tenant: TenantPrincipal,
    establishmentId: string,
  ): Promise<MenuListResponse> {
    if (!tenant.establishmentIds.includes(establishmentId)) this.menuNotFound();

    const menus = await this.database.menu.findMany({
      where: {
        establishmentId,
        organizationId: tenant.organizationId,
        status: { in: ['DRAFT', 'ACTIVE'] },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, status: true },
    });
    return {
      establishmentId,
      menus: menus.map((menu) => ({
        id: menu.id,
        name: menu.name,
        status: menu.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
      })),
    };
  }

  async createCategory(
    tenant: TenantPrincipal,
    menuId: string,
    input: CategoryCreateInput,
  ): Promise<CategoryResponse> {
    this.assertCanManage(tenant);
    return this.database.$transaction(async (transaction) => {
      await this.lockEditableMenu(transaction, tenant, menuId);
      const name = cleanName(input.name);
      try {
        const latest = await transaction.category.aggregate({
          where: { organizationId: tenant.organizationId, menuId, archivedAt: null },
          _max: { displayOrder: true },
        });
        const created = await transaction.category.create({
          data: {
            organizationId: tenant.organizationId,
            menuId,
            name,
            normalizedName: normalizeCategoryName(name),
            description: cleanDescription(input.description),
            displayOrder: (latest._max.displayOrder ?? -1) + 1,
          },
          select: categorySelect,
        });
        return this.toResponse(created);
      } catch (error) {
        this.handlePersistenceError(error);
      }
    });
  }

  async updateCategory(
    tenant: TenantPrincipal,
    menuId: string,
    categoryId: string,
    input: CategoryUpdateInput,
  ): Promise<CategoryResponse> {
    this.assertCanManage(tenant);
    return this.database.$transaction(async (transaction) => {
      await this.lockEditableMenu(transaction, tenant, menuId);
      const current = await this.findCategory(
        transaction,
        tenant.organizationId,
        menuId,
        categoryId,
      );
      this.assertNotArchived(current);
      if (Object.keys(input).length === 0) return this.toResponse(current);

      const data: Prisma.CategoryUpdateInput = {};
      if (input.name !== undefined) {
        const name = cleanName(input.name);
        data.name = name;
        data.normalizedName = normalizeCategoryName(name);
      }
      if (input.description !== undefined) data.description = cleanDescription(input.description);

      try {
        const updated = await transaction.category.update({
          where: { id_organizationId: { id: categoryId, organizationId: tenant.organizationId } },
          data,
          select: categorySelect,
        });
        return this.toResponse(updated);
      } catch (error) {
        this.handlePersistenceError(error);
      }
    });
  }

  activateCategory(
    tenant: TenantPrincipal,
    menuId: string,
    categoryId: string,
  ): Promise<CategoryResponse> {
    return this.changeStatus(tenant, menuId, categoryId, 'ACTIVE');
  }

  deactivateCategory(
    tenant: TenantPrincipal,
    menuId: string,
    categoryId: string,
  ): Promise<CategoryResponse> {
    return this.changeStatus(tenant, menuId, categoryId, 'INACTIVE');
  }

  async archiveCategory(
    tenant: TenantPrincipal,
    menuId: string,
    categoryId: string,
  ): Promise<CategoryResponse> {
    this.assertCanManage(tenant);
    return this.database.$transaction(async (transaction) => {
      await this.lockEditableMenu(transaction, tenant, menuId);
      const current = await this.findCategory(
        transaction,
        tenant.organizationId,
        menuId,
        categoryId,
      );
      this.assertNotArchived(current);

      const archived = await transaction.category.update({
        where: { id_organizationId: { id: categoryId, organizationId: tenant.organizationId } },
        data: { status: 'INACTIVE', archivedAt: new Date() },
        select: categorySelect,
      });
      await this.normalizeOrders(transaction, tenant.organizationId, menuId);
      return this.toResponse(archived);
    });
  }

  async reorderCategories(
    tenant: TenantPrincipal,
    menuId: string,
    input: CategoryReorderInput,
  ): Promise<CategoryListResponse> {
    this.assertCanManage(tenant);
    return this.database.$transaction(async (transaction) => {
      await this.lockEditableMenu(transaction, tenant, menuId);
      const categories = await transaction.category.findMany({
        where: { organizationId: tenant.organizationId, menuId, archivedAt: null },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: categorySelect,
      });
      this.assertCompleteReorder(input, categories);

      const byId = new Map(categories.map((category) => [category.id, category]));
      for (const [displayOrder, categoryId] of input.categoryIds.entries()) {
        const category = byId.get(categoryId);
        if (!category) this.invalidReorder();
        await transaction.category.update({
          where: { id_organizationId: { id: categoryId, organizationId: tenant.organizationId } },
          data: { displayOrder },
          select: categorySelect,
        });
      }

      return this.listForMenuWithClient(transaction, tenant.organizationId, menuId);
    });
  }

  private async changeStatus(
    tenant: TenantPrincipal,
    menuId: string,
    categoryId: string,
    status: CategoryStatus,
  ): Promise<CategoryResponse> {
    this.assertCanManage(tenant);
    return this.database.$transaction(async (transaction) => {
      await this.lockEditableMenu(transaction, tenant, menuId);
      const current = await this.findCategory(
        transaction,
        tenant.organizationId,
        menuId,
        categoryId,
      );
      this.assertNotArchived(current);
      const updated = await transaction.category.update({
        where: { id_organizationId: { id: categoryId, organizationId: tenant.organizationId } },
        data: { status },
        select: categorySelect,
      });
      return this.toResponse(updated);
    });
  }

  private async changeProductStatus(
    tenant: TenantPrincipal,
    menuId: string,
    productId: string,
    status: ProductStatus,
  ): Promise<ProductResponse> {
    this.assertCanManage(tenant);
    return this.database.$transaction(async (transaction) => {
      await this.lockEditableMenu(transaction, tenant, menuId);
      const current = await this.findProduct(transaction, tenant.organizationId, menuId, productId);
      this.assertProductNotArchived(current);
      const updated = await transaction.product.update({
        where: { id_organizationId: { id: productId, organizationId: tenant.organizationId } },
        data: { status },
        select: productSelect,
      });
      return this.toProductResponse(updated);
    });
  }

  private async findMenu(tenant: TenantPrincipal, menuId: string) {
    const menu = await this.database.menu.findFirst({
      where: { id: menuId, organizationId: tenant.organizationId },
      select: { id: true, status: true, establishmentId: true },
    });
    if (!menu) this.menuNotFound();
    if (!tenant.establishmentIds.includes(menu.establishmentId)) this.menuNotFound();
    return menu;
  }

  private async lockEditableMenu(
    database: DatabaseClient,
    tenant: TenantPrincipal,
    menuId: string,
  ) {
    const menus = await database.$queryRaw<
      Array<{ id: string; status: string; establishment_id: string }>
    >`
      SELECT "id", "status", "establishment_id"
      FROM "menus"
      WHERE "id" = ${menuId}::uuid
        AND "organization_id" = ${tenant.organizationId}::uuid
      FOR UPDATE
    `;
    const menu = menus[0];
    if (!menu) this.menuNotFound();
    if (!tenant.establishmentIds.includes(menu.establishment_id)) this.menuNotFound();
    if (menu.status === 'ARCHIVED') this.menuArchived();
    return menu;
  }

  private async findCategory(
    database: DatabaseClient,
    organizationId: string,
    menuId: string,
    categoryId: string,
  ): Promise<CategoryRecord> {
    const category = await database.category.findFirst({
      where: { id: categoryId, organizationId, menuId },
      select: categorySelect,
    });
    if (!category) this.categoryNotFound();
    return category;
  }

  private async findProductCategory(
    database: DatabaseClient,
    organizationId: string,
    menuId: string,
    categoryId: string,
    allowArchived = false,
  ): Promise<void> {
    const category = await database.category.findFirst({
      where: {
        id: categoryId,
        organizationId,
        menuId,
        ...(allowArchived ? {} : { archivedAt: null }),
      },
      select: { id: true },
    });
    if (!category) this.categoryNotFound();
  }

  private async findProduct(
    database: DatabaseClient,
    organizationId: string,
    menuId: string,
    productId: string,
  ): Promise<ProductRecord> {
    const product = await database.product.findFirst({
      where: { id: productId, organizationId, menuId },
      select: productSelect,
    });
    if (!product) this.productNotFound();
    return product;
  }

  private async listForMenu(organizationId: string, menuId: string): Promise<CategoryListResponse> {
    return this.listForMenuWithClient(this.database, organizationId, menuId);
  }

  private async listForMenuWithClient(
    database: DatabaseClient,
    organizationId: string,
    menuId: string,
  ): Promise<CategoryListResponse> {
    const categories = await database.category.findMany({
      where: { organizationId, menuId },
      orderBy: [
        { archivedAt: 'asc' },
        { displayOrder: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      select: categorySelect,
    });
    return { menuId, categories: categories.map((category) => this.toResponse(category)) };
  }

  private async listProductsForMenu(
    organizationId: string,
    menuId: string,
  ): Promise<ProductListResponse> {
    return this.listProductsForMenuWithClient(this.database, organizationId, menuId);
  }

  private async listProductsForMenuWithClient(
    database: DatabaseClient,
    organizationId: string,
    menuId: string,
  ): Promise<ProductListResponse> {
    const products = await database.product.findMany({
      where: { organizationId, menuId },
      orderBy: [
        { archivedAt: 'asc' },
        { displayOrder: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      select: productSelect,
    });
    return { menuId, products: products.map((product) => this.toProductResponse(product)) };
  }

  private async normalizeOrders(
    database: DatabaseClient,
    organizationId: string,
    menuId: string,
  ): Promise<void> {
    const categories = await database.category.findMany({
      where: { organizationId, menuId, archivedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    for (const [displayOrder, category] of categories.entries()) {
      await database.category.update({
        where: { id_organizationId: { id: category.id, organizationId } },
        data: { displayOrder },
      });
    }
  }

  private async normalizeProductOrders(
    database: DatabaseClient,
    organizationId: string,
    menuId: string,
  ): Promise<void> {
    const products = await database.product.findMany({
      where: { organizationId, menuId, archivedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    for (const [displayOrder, product] of products.entries()) {
      await database.product.update({
        where: { id_organizationId: { id: product.id, organizationId } },
        data: { displayOrder },
      });
    }
  }

  private assertCompleteReorder(
    input: CategoryReorderInput,
    categories: ReadonlyArray<{ id: string }>,
  ): void {
    const categoryIds = new Set(categories.map((category) => category.id));
    const requestedIds = new Set(input.categoryIds);
    if (
      requestedIds.size !== input.categoryIds.length ||
      requestedIds.size !== categoryIds.size ||
      input.categoryIds.some((categoryId) => !categoryIds.has(categoryId))
    ) {
      this.invalidReorder();
    }
  }

  private assertCompleteProductReorder(
    input: ProductReorderInput,
    products: ReadonlyArray<{ id: string }>,
  ): void {
    const productIds = new Set(products.map((product) => product.id));
    const requestedIds = new Set(input.productIds);
    if (
      requestedIds.size !== input.productIds.length ||
      requestedIds.size !== productIds.size ||
      input.productIds.some((productId) => !productIds.has(productId))
    ) {
      this.invalidProductReorder();
    }
  }

  private assertCanManage(tenant: TenantPrincipal): void {
    if (!hasPermission(tenant.role, Permission.CATALOG_WRITE)) {
      throw new StableHttpException(
        HttpStatus.FORBIDDEN,
        'CATALOG_MANAGEMENT_ACCESS_DENIED',
        'Apenas proprietários e administradores podem gerenciar categorias.',
      );
    }
  }

  private assertProductNotArchived(product: ProductRecord): void {
    if (product.archivedAt) {
      throw new StableHttpException(
        HttpStatus.CONFLICT,
        'PRODUCT_ARCHIVED',
        'Produtos arquivados não podem mais ser alterados.',
      );
    }
  }

  private assertNotArchived(category: CategoryRecord): void {
    if (category.archivedAt) {
      throw new StableHttpException(
        HttpStatus.CONFLICT,
        'CATEGORY_ARCHIVED',
        'Categorias arquivadas não podem mais ser alteradas.',
      );
    }
  }

  private toResponse(category: CategoryRecord): CategoryResponse {
    return {
      id: category.id,
      menuId: category.menuId,
      name: category.name,
      description: category.description,
      displayOrder: category.displayOrder,
      status: category.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      archivedAt: category.archivedAt?.toISOString() ?? null,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  private toProductResponse(product: ProductRecord): ProductResponse {
    return {
      id: product.id,
      menuId: product.menuId,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      price: formatMoney(product.price),
      promotionalPrice:
        product.promotionalPrice === null ? null : formatMoney(product.promotionalPrice),
      ingredients: product.ingredients,
      allergens: product.allergens,
      availability: product.availability as ProductAvailability,
      featured: product.featured,
      status: product.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      archivedAt: product.archivedAt?.toISOString() ?? null,
      displayOrder: product.displayOrder,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private handlePersistenceError(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new StableHttpException(
        HttpStatus.CONFLICT,
        'CATEGORY_NAME_ALREADY_IN_USE',
        'Já existe uma categoria com este nome neste menu.',
      );
    }
    throw error;
  }

  private invalidReorder(): never {
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'CATEGORY_REORDER_INVALID',
      'A reordenação deve informar exatamente todas as categorias não arquivadas, uma única vez.',
    );
  }

  private invalidProductReorder(): never {
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'PRODUCT_REORDER_INVALID',
      'A reordenação deve informar exatamente todos os produtos não arquivados, uma única vez.',
    );
  }

  private menuNotFound(): never {
    throw new StableHttpException(HttpStatus.NOT_FOUND, 'MENU_NOT_FOUND', 'Menu não encontrado.');
  }

  private menuArchived(): never {
    throw new StableHttpException(
      HttpStatus.CONFLICT,
      'MENU_ARCHIVED',
      'Menus arquivados não podem receber alterações.',
    );
  }

  private categoryNotFound(): never {
    throw new StableHttpException(
      HttpStatus.NOT_FOUND,
      'CATEGORY_NOT_FOUND',
      'Categoria não encontrada neste menu.',
    );
  }

  private productNotFound(): never {
    throw new StableHttpException(
      HttpStatus.NOT_FOUND,
      'PRODUCT_NOT_FOUND',
      'Produto não encontrado neste menu.',
    );
  }
}

function normalizeCategoryName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function cleanName(name: string): string {
  const cleaned = name.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (cleaned.length === 0) {
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'CATEGORY_NAME_INVALID',
      'O nome da categoria é obrigatório.',
    );
  }
  return cleaned;
}

function cleanDescription(description: string | null | undefined): string | null {
  const cleaned = description?.trim() ?? '';
  return cleaned.length > 0 ? cleaned : null;
}

function cleanProductName(name: string): string {
  const cleaned = name.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (cleaned.length === 0) {
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'PRODUCT_NAME_INVALID',
      'O nome do produto é obrigatório.',
    );
  }
  return cleaned;
}

function cleanProductText(value: string | null | undefined): string | null {
  const cleaned = value?.trim() ?? '';
  return cleaned.length > 0 ? cleaned : null;
}

function cleanMoney(value: string, code: 'PRODUCT_PRICE_INVALID'): string {
  const cleaned = value.trim();
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(cleaned)) {
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      code,
      'Informe um valor monetário válido com até duas casas decimais.',
    );
  }
  const [integer, decimals = ''] = cleaned.split('.');
  return `${integer}.${decimals.padEnd(2, '0')}`;
}

function cleanOptionalMoney(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : cleanMoney(value, 'PRODUCT_PRICE_INVALID');
}

function assertMoneyCents(left: string, right: string): number {
  const leftCents = BigInt(left.replace('.', ''));
  const rightCents = BigInt(right.replace('.', ''));
  return leftCents === rightCents ? 0 : leftCents > rightCents ? 1 : -1;
}

function assertPromotionalPrice(price: string, promotionalPrice: string | null): void {
  if (promotionalPrice !== null && assertMoneyCents(promotionalPrice, price) > 0) {
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'PROMOTIONAL_PRICE_INVALID',
      'O preço promocional não pode ser maior que o preço normal.',
    );
  }
}

function formatMoney(value: { toFixed: (digits: number) => string } | string): string {
  if (typeof value === 'string') return cleanMoney(value, 'PRODUCT_PRICE_INVALID');
  return value.toFixed(2);
}
