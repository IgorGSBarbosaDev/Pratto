import { Module } from '@nestjs/common';

import { PermissionGuard } from './presentation/permission.guard';

@Module({ providers: [PermissionGuard], exports: [PermissionGuard] })
export class AuthorizationModule {}
