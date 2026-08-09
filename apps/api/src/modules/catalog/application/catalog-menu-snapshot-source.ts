import { Injectable } from '@nestjs/common';
import type { MenuSnapshot, MenuSnapshotInput, MenuSnapshotSource, Prisma } from '@pratto/database';

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
        establishment: {
          select: {
            id: true,
            publicId: true,
            name: true,
            slug: true,
            description: true,
            phone: true,
            whatsapp: true,
            address: true,
            operatingHours: true,
            logoKey: true,
            logoContentType: true,
            coverImageKey: true,
            coverImageContentType: true,
            themeSettings: true,
          },
        },
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
    const productIds = products.map((product) => product.id);
    const media =
      productIds.length === 0
        ? []
        : await input.transaction.productMedia.findMany({
            where: {
              menuId: input.menuId,
              organizationId: input.organizationId,
              productId: { in: productIds },
            },
            orderBy: [
              { productId: 'asc' },
              { displayOrder: 'asc' },
              { createdAt: 'asc' },
              { id: 'asc' },
            ],
            select: {
              id: true,
              productId: true,
              mediaType: true,
              contentType: true,
              storageKey: true,
              displayOrder: true,
              isPrimary: true,
            },
          });
    const productOrder = new Map(products.map((product, index) => [product.id, index]));
    media.sort(
      (left, right) =>
        (productOrder.get(left.productId) ?? Number.MAX_SAFE_INTEGER) -
          (productOrder.get(right.productId) ?? Number.MAX_SAFE_INTEGER) ||
        left.displayOrder - right.displayOrder ||
        left.id.localeCompare(right.id),
    );

    return {
      schemaVersion: 3,
      establishment: {
        id: menu.establishment.id,
        publicId: menu.establishment.publicId,
        name: menu.establishment.name,
        slug: menu.establishment.slug,
        description: menu.establishment.description,
        phone: menu.establishment.phone,
        whatsapp: menu.establishment.whatsapp,
        address: menu.establishment.address as Prisma.InputJsonValue | null,
        operatingHours: menu.establishment.operatingHours as Prisma.InputJsonValue,
        logo: menu.establishment.logoKey
          ? {
              storageKey: menu.establishment.logoKey,
              contentType: menu.establishment.logoContentType,
            }
          : null,
        coverImage: menu.establishment.coverImageKey
          ? {
              storageKey: menu.establishment.coverImageKey,
              contentType: menu.establishment.coverImageContentType,
            }
          : null,
        theme: menu.establishment.themeSettings as Prisma.InputJsonValue,
      },
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
      media: media.map((item) => ({
        id: item.id,
        productId: item.productId,
        mediaType: item.mediaType,
        contentType: item.contentType,
        storageKey: item.storageKey,
        displayOrder: item.displayOrder,
        isPrimary: item.isPrimary,
      })),
    };
  }
}

function formatSnapshotMoney(value: { toFixed: (digits: number) => string } | string): string {
  return typeof value === 'string' ? value : value.toFixed(2);
}
