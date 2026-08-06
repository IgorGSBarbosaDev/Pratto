import { Module } from '@nestjs/common';

import { IdentityModule } from '../identity/identity.module';

import { OrganizationGuard } from './presentation/organization.guard';

@Module({ imports: [IdentityModule], providers: [OrganizationGuard], exports: [OrganizationGuard] })
export class OrganizationsModule {}
