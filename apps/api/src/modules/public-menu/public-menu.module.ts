import { Module } from '@nestjs/common';

import { StorageModule } from '../../infrastructure/storage/storage.module';

import { PublicMenuService } from './application/public-menu.service';
import { PublicMenuController } from './presentation/public-menu.controller';

@Module({
  imports: [StorageModule],
  controllers: [PublicMenuController],
  providers: [PublicMenuService],
})
export class PublicMenuModule {}
