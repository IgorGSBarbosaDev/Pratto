import { Injectable } from '@nestjs/common';
import type { MenuSnapshot, MenuSnapshotInput, MenuSnapshotSource } from '@pratto/database';

@Injectable()
export class CatalogMenuSnapshotSource implements MenuSnapshotSource {
  async buildSnapshot(input: MenuSnapshotInput): Promise<MenuSnapshot> {
    const menu = await input.transaction.menu.findFirstOrThrow({
      where: {
        id: input.menuId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        name: true,
      },
    });
    const categories = await input.transaction.category.findMany({
      where: {
        menuId: input.menuId,
        organizationId: input.organizationId,
        status: 'ACTIVE',
        archivedAt: null,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        displayOrder: true,
      },
    });
    const products = await input.transaction.product.findMany({
      where: {
        menuId: input.menuId,
        organizationId: input.organizationId,
        status: 'ACTIVE',
        archivedAt: null,
        category: {
          status: 'ACTIVE',
          archivedAt: null,
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        price: true,
        promotionalPrice: true,
        ingredients: true,
        allergens: true,
        availability: true,
        featured: true,
        displayOrder: true,
      },
    });

    return {
      schemaVersion: 1,
      menu: {
        id: menu.id,
        name: menu.name,
      },
      categories,
      products: products.map((product) => ({
        id: product.id,
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        price: formatSnapshotMoney(product.price),
        promotionalPrice:
          product.promotionalPrice === null ? null : formatSnapshotMoney(product.promotionalPrice),
        ingredients: product.ingredients,
        allergens: product.allergens,
        availability: product.availability,
        featured: product.featured,
        displayOrder: product.displayOrder,
      })),
      media: [],
    };
  }
}

function formatSnapshotMoney(value: { toFixed: (digits: number) => string } | string): string {
  return typeof value === 'string' ? value : value.toFixed(2);
}
