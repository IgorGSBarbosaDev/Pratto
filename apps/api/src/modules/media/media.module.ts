import { Module } from '@nestjs/common';

import { StorageModule } from '../../infrastructure/storage/storage.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';

import { ProductMediaService } from './application/product-media.service';
import { ProductMediaController } from './presentation/product-media.controller';

@Module({
  imports: [IdentityModule, OrganizationsModule, StorageModule],
  controllers: [ProductMediaController],
  providers: [ProductMediaService],
})
export class MediaModule {}
