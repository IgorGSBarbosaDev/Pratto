import { Module } from '@nestjs/common';

import { EstablishmentAuthorizationService } from './application/establishment-authorization.service';
import { PermissionGuard } from './presentation/permission.guard';

@Module({
  providers: [EstablishmentAuthorizationService, PermissionGuard],
  exports: [EstablishmentAuthorizationService, PermissionGuard],
})
export class AuthorizationModule {}
