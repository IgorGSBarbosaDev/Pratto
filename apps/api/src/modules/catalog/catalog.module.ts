import { Module } from '@nestjs/common';

import { AuthorizationModule } from '../authorization/authorization.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';

import { CatalogMenuSnapshotSource } from './application/catalog-menu-snapshot-source';
import { CatalogService } from './application/catalog.service';
import { CatalogController } from './presentation/catalog.controller';

@Module({
  imports: [AuthorizationModule, IdentityModule, OrganizationsModule],
  controllers: [CatalogController],
  providers: [CatalogMenuSnapshotSource, CatalogService],
  exports: [CatalogMenuSnapshotSource],
})
export class CatalogModule {}
