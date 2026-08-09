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

    return {
      schemaVersion: 1,
      menu: {
        id: menu.id,
        name: menu.name,
      },
      categories,
      products: [],
      media: [],
    };
  }
}
