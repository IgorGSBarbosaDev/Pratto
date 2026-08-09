import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';

import { PublicationService } from './application/publication.service';
import { PublicationController } from './presentation/publication.controller';

@Module({
  imports: [CatalogModule, IdentityModule, OrganizationsModule],
  controllers: [PublicationController],
  providers: [PublicationService],
})
export class PublicationModule {}
