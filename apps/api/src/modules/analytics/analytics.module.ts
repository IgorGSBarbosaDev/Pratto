import { Module } from '@nestjs/common';

import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';

import { AnalyticsDashboardService } from './application/analytics-dashboard.service';
import { AnalyticsQueryService } from './application/analytics-query.service';
import { AnalyticsRateLimitService } from './application/analytics-rate-limit.service';
import { AnalyticsRetentionService } from './application/analytics-retention.service';
import { AnalyticsService } from './application/analytics.service';
import { AnalyticsDashboardController } from './presentation/analytics-dashboard.controller';
import { AnalyticsController } from './presentation/analytics.controller';

@Module({
  imports: [IdentityModule, OrganizationsModule],
  controllers: [AnalyticsController, AnalyticsDashboardController],
  providers: [
    AnalyticsDashboardService,
    AnalyticsRateLimitService,
    AnalyticsQueryService,
    AnalyticsRetentionService,
    AnalyticsService,
  ],
  exports: [AnalyticsQueryService],
})
export class AnalyticsModule {}
