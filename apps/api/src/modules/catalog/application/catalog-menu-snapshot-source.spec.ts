import type { MenuSnapshotInput } from '@pratto/database';

import { CatalogMenuSnapshotSource } from './catalog-menu-snapshot-source';

describe('CatalogMenuSnapshotSource', () => {
  it('snapshots the editable menu in the requested tenant shape', async () => {
    const findFirstOrThrow = jest.fn().mockResolvedValue({
      id: 'menu-id',
      name: 'Menu principal',
    });
    const transaction = {
      menu: { findFirstOrThrow },
    } as unknown as MenuSnapshotInput['transaction'];

    const snapshot = await new CatalogMenuSnapshotSource().buildSnapshot({
      transaction,
      menuId: 'menu-id',
      organizationId: 'organization-id',
    });

    expect(findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'menu-id', organizationId: 'organization-id' },
      select: { id: true, name: true },
    });
    expect(snapshot).toEqual({
      schemaVersion: 1,
      menu: { id: 'menu-id', name: 'Menu principal' },
      categories: [],
      products: [],
      media: [],
    });
  });
});
