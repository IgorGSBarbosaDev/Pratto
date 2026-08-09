import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CategoryListResponse,
  CategoryResponse,
  CategoryStatus,
  MenuListResponse,
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
type DatabaseClient = Prisma.TransactionClient | typeof prisma;

export const CATEGORY_MANAGER_ROLES = new Set(['OWNER', 'ADMIN']);

@Injectable()
export class CatalogService {
  private readonly database = prisma;

  async listCategories(tenant: TenantPrincipal, menuId: string): Promise<CategoryListResponse> {
    const menu = await this.findMenu(tenant, menuId);
    return this.listForMenu(tenant.organizationId, menu.id);
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
      const current = await this.findCategory(transaction, tenant.organizationId, menuId, categoryId);
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
      const current = await this.findCategory(transaction, tenant.organizationId, menuId, categoryId);
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
      const current = await this.findCategory(transaction, tenant.organizationId, menuId, categoryId);
      this.assertNotArchived(current);
      const updated = await transaction.category.update({
        where: { id_organizationId: { id: categoryId, organizationId: tenant.organizationId } },
        data: { status },
        select: categorySelect,
      });
      return this.toResponse(updated);
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
    const menus = await database.$queryRaw<Array<{ id: string; status: string; establishment_id: string }>>`
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

  private assertCanManage(tenant: TenantPrincipal): void {
    if (!CATEGORY_MANAGER_ROLES.has(tenant.role)) {
      throw new StableHttpException(
        HttpStatus.FORBIDDEN,
        'CATALOG_MANAGEMENT_ACCESS_DENIED',
        'Apenas proprietários e administradores podem gerenciar categorias.',
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
