import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadEnvironment } from '@pratto/config';
import { LoggerModule } from 'nestjs-pino';

import { EmailModule } from './infrastructure/email/email.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { HealthModule } from './modules/health/health.module';

const environment = loadEnvironment();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: false }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: environment.LOG_LEVEL,
        genReqId: (request) => request.headers['x-request-id']?.toString() ?? randomUUID(),
        redact: ['req.headers.cookie', 'req.headers.authorization'],
      },
    }),
    StorageModule,
    EmailModule,
    HealthModule,
  ],
})
export class AppModule {}
