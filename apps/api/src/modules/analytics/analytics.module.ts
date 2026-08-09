import { Module } from '@nestjs/common';

import { AnalyticsQueryService } from './application/analytics-query.service';
import { AnalyticsRateLimitService } from './application/analytics-rate-limit.service';
import { AnalyticsRetentionService } from './application/analytics-retention.service';
import { AnalyticsService } from './application/analytics.service';
import { AnalyticsController } from './presentation/analytics.controller';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsRateLimitService,
    AnalyticsQueryService,
    AnalyticsRetentionService,
    AnalyticsService,
  ],
  exports: [AnalyticsQueryService],
})
export class AnalyticsModule {}
