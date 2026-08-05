import { Module } from '@nestjs/common';
import { STORAGE_SERVICE } from '@pratto/contracts';

import { MinioStorageService } from './minio-storage.service';

@Module({
  providers: [{ provide: STORAGE_SERVICE, useClass: MinioStorageService }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
