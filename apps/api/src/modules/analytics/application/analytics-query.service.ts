import { Injectable } from '@nestjs/common';
import type {
  AnalyticsCategoryMetric,
  AnalyticsDailyMetric,
  AnalyticsProductMetric,
  AnalyticsSummary,
} from '@pratto/contracts';
import { prisma } from '@pratto/database';

export interface AnalyticsQueryScope {
  organizationId: string;
  establishmentId: string;
  from: Date;
  to: Date;
}

interface SummaryRow {
  sessions: bigint | number;
  impressions: bigint | number;
  qualifiedViews: bigint | number;
  interactions: bigint | number;
  categoryViews: bigint | number;
}

interface DailyRow extends SummaryRow {
  day: Date | string;
}

interface ProductRow {
  productId: string;
  impressions: bigint | number;
  qualifiedViews: bigint | number;
  interactions: bigint | number;
}

interface CategoryRow {
  categoryId: string;
  views: bigint | number;
}

@Injectable()
export class AnalyticsQueryService {
  async summary(scope: AnalyticsQueryScope): Promise<AnalyticsSummary> {
    const rows = await prisma.$queryRaw<SummaryRow[]>`
      SELECT
        COUNT(DISTINCT "session_id")::bigint AS "sessions",
        COUNT(*) FILTER (WHERE "event_type" = 'PRODUCT_IMPRESSION')::bigint AS "impressions",
        COUNT(*) FILTER (WHERE "event_type" = 'PRODUCT_VIEWED')::bigint AS "qualifiedViews",
        COUNT(*) FILTER (WHERE "event_type" = 'PRODUCT_INTERACTION')::bigint AS "interactions",
        COUNT(*) FILTER (WHERE "event_type" = 'CATEGORY_SELECTED')::bigint AS "categoryViews"
      FROM "analytics_events"
      WHERE "organization_id" = ${scope.organizationId}::uuid
        AND "establishment_id" = ${scope.establishmentId}::uuid
        AND "occurred_at" >= ${scope.from}
        AND "occurred_at" < ${scope.to}
    `;
    return this.toSummary(rows[0]);
  }

  async daily(scope: AnalyticsQueryScope): Promise<AnalyticsDailyMetric[]> {
    const rows = await prisma.$queryRaw<DailyRow[]>`
      SELECT
        date_trunc('day', "occurred_at")::date AS "day",
        COUNT(DISTINCT "session_id")::bigint AS "sessions",
        COUNT(*) FILTER (WHERE "event_type" = 'PRODUCT_IMPRESSION')::bigint AS "impressions",
        COUNT(*) FILTER (WHERE "event_type" = 'PRODUCT_VIEWED')::bigint AS "qualifiedViews",
        COUNT(*) FILTER (WHERE "event_type" = 'PRODUCT_INTERACTION')::bigint AS "interactions",
        COUNT(*) FILTER (WHERE "event_type" = 'CATEGORY_SELECTED')::bigint AS "categoryViews"
      FROM "analytics_events"
      WHERE "organization_id" = ${scope.organizationId}::uuid
        AND "establishment_id" = ${scope.establishmentId}::uuid
        AND "occurred_at" >= ${scope.from}
        AND "occurred_at" < ${scope.to}
      GROUP BY date_trunc('day', "occurred_at")::date
      ORDER BY "day" ASC
    `;
    return rows.map((row) => ({ day: this.toDay(row.day), ...this.toSummary(row) }));
  }

  async products(scope: AnalyticsQueryScope): Promise<AnalyticsProductMetric[]> {
    const rows = await prisma.$queryRaw<ProductRow[]>`
      SELECT
        "product_id"::text AS "productId",
        COUNT(*) FILTER (WHERE "event_type" = 'PRODUCT_IMPRESSION')::bigint AS "impressions",
        COUNT(*) FILTER (WHERE "event_type" = 'PRODUCT_VIEWED')::bigint AS "qualifiedViews",
        COUNT(*) FILTER (WHERE "event_type" = 'PRODUCT_INTERACTION')::bigint AS "interactions"
      FROM "analytics_events"
      WHERE "organization_id" = ${scope.organizationId}::uuid
        AND "establishment_id" = ${scope.establishmentId}::uuid
        AND "occurred_at" >= ${scope.from}
        AND "occurred_at" < ${scope.to}
        AND "product_id" IS NOT NULL
      GROUP BY "product_id"
      ORDER BY "qualifiedViews" DESC, "impressions" DESC, "productId" ASC
    `;
    return rows.map((row) => ({
      productId: row.productId,
      impressions: this.toNumber(row.impressions),
      qualifiedViews: this.toNumber(row.qualifiedViews),
      interactions: this.toNumber(row.interactions),
    }));
  }

  async categories(scope: AnalyticsQueryScope): Promise<AnalyticsCategoryMetric[]> {
    const rows = await prisma.$queryRaw<CategoryRow[]>`
      SELECT
        "category_id"::text AS "categoryId",
        COUNT(*) FILTER (WHERE "event_type" = 'CATEGORY_SELECTED')::bigint AS "views"
      FROM "analytics_events"
      WHERE "organization_id" = ${scope.organizationId}::uuid
        AND "establishment_id" = ${scope.establishmentId}::uuid
        AND "occurred_at" >= ${scope.from}
        AND "occurred_at" < ${scope.to}
        AND "category_id" IS NOT NULL
      GROUP BY "category_id"
      ORDER BY "views" DESC, "categoryId" ASC
    `;
    return rows.map((row) => ({ categoryId: row.categoryId, views: this.toNumber(row.views) }));
  }

  private toSummary(row: SummaryRow | undefined): AnalyticsSummary {
    return {
      sessions: this.toNumber(row?.sessions),
      impressions: this.toNumber(row?.impressions),
      qualifiedViews: this.toNumber(row?.qualifiedViews),
      interactions: this.toNumber(row?.interactions),
      categoryViews: this.toNumber(row?.categoryViews),
    };
  }

  private toNumber(value: bigint | number | undefined): number {
    return typeof value === 'bigint' ? Number(value) : (value ?? 0);
  }

  private toDay(value: Date | string): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : value;
  }
}
