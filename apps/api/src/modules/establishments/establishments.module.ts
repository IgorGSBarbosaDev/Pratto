import { Module } from '@nestjs/common';

import { StorageModule } from '../../infrastructure/storage/storage.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';

import { EstablishmentService } from './application/establishment.service';
import { EstablishmentController } from './presentation/establishment.controller';

@Module({
  imports: [AuthorizationModule, IdentityModule, OrganizationsModule, StorageModule],
  controllers: [EstablishmentController],
  providers: [EstablishmentService],
})
export class EstablishmentsModule {}
