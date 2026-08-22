import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadEnvironment } from '@pratto/config';
import { LoggerModule } from 'nestjs-pino';

import { EmailModule } from './infrastructure/email/email.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { EstablishmentsModule } from './modules/establishments/establishments.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { MediaModule } from './modules/media/media.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PublicMenuModule } from './modules/public-menu/public-menu.module';
import { PublicationModule } from './modules/publication/publication.module';
import { TeamModule } from './modules/team/team.module';

const environment = loadEnvironment();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: false }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: environment.LOG_LEVEL,
        genReqId: (request) => request.headers['x-request-id']?.toString() ?? randomUUID(),
        redact: [
          'req.headers.cookie',
          'req.headers.authorization',
          'req.headers.x-csrf-token',
          'req.body.password',
          'req.body.token',
        ],
      },
    }),
    StorageModule,
    EmailModule,
    AnalyticsModule,
    CatalogModule,
    EstablishmentsModule,
    IdentityModule,
    MediaModule,
    OrganizationsModule,
    PublicationModule,
    PublicMenuModule,
    HealthModule,
    TeamModule,
  ],
})
export class AppModule {}
