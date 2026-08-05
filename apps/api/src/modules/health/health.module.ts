import { Module } from '@nestjs/common';

import { EmailModule } from '../../infrastructure/email/email.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [StorageModule, EmailModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
