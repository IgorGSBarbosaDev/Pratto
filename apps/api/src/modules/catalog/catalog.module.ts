import { Module } from '@nestjs/common';

import { CatalogMenuSnapshotSource } from './application/catalog-menu-snapshot-source';

@Module({
  providers: [CatalogMenuSnapshotSource],
  exports: [CatalogMenuSnapshotSource],
})
export class CatalogModule {}
