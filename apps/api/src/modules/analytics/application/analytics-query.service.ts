import { Injectable } from '@nestjs/common';
import type {
  AnalyticsCategoryMetric,
  AnalyticsDailyMetric,
  AnalyticsProductMetric,
  AnalyticsSummary,
} from '@pratto/contracts';
import { prisma, Prisma } from '@pratto/database';

export interface AnalyticsQueryScope {
  organizationId: string;
  establishmentId: string;
  from: Date;
  to: Date;
  categoryId?: string;
  productId?: string;
}

interface SummaryRow {
  sessions: bigint | number;
  menuAccesses: bigint | number;
  impressions: bigint | number;
  qualifiedViews: bigint | number;
  interactions: bigint | number;
  contactClicks: bigint | number;
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
    const productFilter = this.productFilter(scope);
    const categoryFilter = this.categoryFilter(scope);
    const rows = await prisma.$queryRaw<SummaryRow[]>`
      SELECT
        COUNT(DISTINCT "session_id")::bigint AS "sessions",
        COUNT(*) FILTER (WHERE "event_type" = 'MENU_OPENED')::bigint AS "menuAccesses",
        COUNT(*) FILTER (
          WHERE "event_type" = 'PRODUCT_IMPRESSION' AND ${productFilter}
        )::bigint AS "impressions",
        COUNT(*) FILTER (
          WHERE "event_type" = 'PRODUCT_VIEWED' AND ${productFilter}
        )::bigint AS "qualifiedViews",
        COUNT(*) FILTER (
          WHERE "event_type" = 'PRODUCT_INTERACTION' AND ${productFilter}
        )::bigint AS "interactions",
        COUNT(*) FILTER (WHERE "event_type" = 'CONTACT_CLICKED')::bigint AS "contactClicks",
        COUNT(*) FILTER (
          WHERE "event_type" = 'CATEGORY_SELECTED' AND ${categoryFilter}
        )::bigint AS "categoryViews"
      FROM "analytics_events"
      ${this.baseWhere(scope)}
    `;
    return this.toSummary(rows[0]);
  }

  async daily(scope: AnalyticsQueryScope): Promise<AnalyticsDailyMetric[]> {
    const productFilter = this.productFilter(scope);
    const categoryFilter = this.categoryFilter(scope);
    const lastMoment = new Date(scope.to.getTime() - 1);
    const rows = await prisma.$queryRaw<DailyRow[]>`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', ${scope.from}),
          date_trunc('day', ${lastMoment}),
          interval '1 day'
        )::date AS "day"
      ), aggregates AS (
        SELECT
          date_trunc('day', "occurred_at")::date AS "day",
          COUNT(DISTINCT "session_id")::bigint AS "sessions",
          COUNT(*) FILTER (WHERE "event_type" = 'MENU_OPENED')::bigint AS "menuAccesses",
          COUNT(*) FILTER (
            WHERE "event_type" = 'PRODUCT_IMPRESSION' AND ${productFilter}
          )::bigint AS "impressions",
          COUNT(*) FILTER (
            WHERE "event_type" = 'PRODUCT_VIEWED' AND ${productFilter}
          )::bigint AS "qualifiedViews",
          COUNT(*) FILTER (
            WHERE "event_type" = 'PRODUCT_INTERACTION' AND ${productFilter}
          )::bigint AS "interactions",
          COUNT(*) FILTER (WHERE "event_type" = 'CONTACT_CLICKED')::bigint AS "contactClicks",
          COUNT(*) FILTER (
            WHERE "event_type" = 'CATEGORY_SELECTED' AND ${categoryFilter}
          )::bigint AS "categoryViews"
        FROM "analytics_events"
        ${this.baseWhere(scope)}
        GROUP BY date_trunc('day', "occurred_at")::date
      )
      SELECT
        days."day",
        COALESCE(aggregates."sessions", 0)::bigint AS "sessions",
        COALESCE(aggregates."menuAccesses", 0)::bigint AS "menuAccesses",
        COALESCE(aggregates."impressions", 0)::bigint AS "impressions",
        COALESCE(aggregates."qualifiedViews", 0)::bigint AS "qualifiedViews",
        COALESCE(aggregates."interactions", 0)::bigint AS "interactions",
        COALESCE(aggregates."contactClicks", 0)::bigint AS "contactClicks",
        COALESCE(aggregates."categoryViews", 0)::bigint AS "categoryViews"
      FROM days
      LEFT JOIN aggregates ON aggregates."day" = days."day"
      ORDER BY days."day" ASC
    `;
    return rows.map((row) => ({ day: this.toDay(row.day), ...this.toSummary(row) }));
  }

  async products(scope: AnalyticsQueryScope): Promise<AnalyticsProductMetric[]> {
    const productFilter = this.productFilter(scope);
    const rows = await prisma.$queryRaw<ProductRow[]>`
      SELECT
        "product_id"::text AS "productId",
        COUNT(*) FILTER (WHERE "event_type" = 'PRODUCT_IMPRESSION')::bigint AS "impressions",
        COUNT(*) FILTER (WHERE "event_type" = 'PRODUCT_VIEWED')::bigint AS "qualifiedViews",
        COUNT(*) FILTER (WHERE "event_type" = 'PRODUCT_INTERACTION')::bigint AS "interactions"
      FROM "analytics_events"
      ${this.baseWhere(scope)}
        AND "product_id" IS NOT NULL
        AND ${productFilter}
      GROUP BY "product_id"
      ORDER BY "qualifiedViews" DESC, "impressions" DESC, "productId" ASC
      LIMIT 10
    `;
    return rows.map((row) => ({
      productId: row.productId,
      impressions: this.toNumber(row.impressions),
      qualifiedViews: this.toNumber(row.qualifiedViews),
      interactions: this.toNumber(row.interactions),
    }));
  }

  async categories(scope: AnalyticsQueryScope): Promise<AnalyticsCategoryMetric[]> {
    const categoryFilter = this.categoryFilter(scope);
    const rows = await prisma.$queryRaw<CategoryRow[]>`
      SELECT
        "category_id"::text AS "categoryId",
        COUNT(*) FILTER (WHERE "event_type" = 'CATEGORY_SELECTED')::bigint AS "views"
      FROM "analytics_events"
      ${this.baseWhere(scope)}
        AND "category_id" IS NOT NULL
        AND ${categoryFilter}
      GROUP BY "category_id"
      ORDER BY "views" DESC, "categoryId" ASC
      LIMIT 10
    `;
    return rows.map((row) => ({ categoryId: row.categoryId, views: this.toNumber(row.views) }));
  }

  private baseWhere(scope: AnalyticsQueryScope): Prisma.Sql {
    return Prisma.sql`
      WHERE "organization_id" = ${scope.organizationId}::uuid
        AND "establishment_id" = ${scope.establishmentId}::uuid
        AND "occurred_at" >= ${scope.from}
        AND "occurred_at" < ${scope.to}
    `;
  }

  private productFilter(scope: AnalyticsQueryScope): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];
    if (scope.categoryId) {
      conditions.push(Prisma.sql`"category_id" = ${scope.categoryId}::uuid`);
    }
    if (scope.productId) {
      conditions.push(Prisma.sql`"product_id" = ${scope.productId}::uuid`);
    }
    return conditions.length > 0
      ? Prisma.sql`(${Prisma.join(conditions, ' AND ')})`
      : Prisma.sql`TRUE`;
  }

  private categoryFilter(scope: AnalyticsQueryScope): Prisma.Sql {
    if (scope.productId) return Prisma.sql`FALSE`;
    if (scope.categoryId) return Prisma.sql`"category_id" = ${scope.categoryId}::uuid`;
    return Prisma.sql`TRUE`;
  }

  private toSummary(row: SummaryRow | undefined): AnalyticsSummary {
    return {
      sessions: this.toNumber(row?.sessions),
      menuAccesses: this.toNumber(row?.menuAccesses),
      impressions: this.toNumber(row?.impressions),
      qualifiedViews: this.toNumber(row?.qualifiedViews),
      interactions: this.toNumber(row?.interactions),
      contactClicks: this.toNumber(row?.contactClicks),
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
