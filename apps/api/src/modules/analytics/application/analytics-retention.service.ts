import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma } from '@pratto/database';

export const ANALYTICS_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const ANALYTICS_RATE_LIMIT_RETENTION_MS = 2 * 60 * 60 * 1000;
export const ANALYTICS_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
export const ANALYTICS_CLEANUP_BATCH_SIZE = 500;

export interface AnalyticsRetentionResult {
  sessionsDeleted: number;
  rateLimitBucketsDeleted: number;
}

interface CleanupCountRow {
  count: bigint | number | string;
}

@Injectable()
export class AnalyticsRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsRetentionService.name);
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupInFlight: Promise<AnalyticsRetentionResult> | null = null;

  onModuleInit(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      void this.runScheduledCleanup();
    }, ANALYTICS_CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (!this.cleanupTimer) return;
    clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  cleanup(now = new Date()): Promise<AnalyticsRetentionResult> {
    if (this.cleanupInFlight) return this.cleanupInFlight;

    this.cleanupInFlight = this.cleanupInternal(now).finally(() => {
      this.cleanupInFlight = null;
    });
    return this.cleanupInFlight;
  }

  private async runScheduledCleanup(): Promise<void> {
    try {
      await this.cleanup();
    } catch {
      this.logger.warn('Analytics retention cleanup failed; it will retry on the next interval.');
    }
  }

  private async cleanupInternal(now: Date): Promise<AnalyticsRetentionResult> {
    const sessionCutoff = new Date(now.getTime() - ANALYTICS_SESSION_RETENTION_MS);
    const rateLimitCutoff = new Date(now.getTime() - ANALYTICS_RATE_LIMIT_RETENTION_MS);
    let sessionsDeleted = 0;
    let rateLimitBucketsDeleted = 0;

    let deleted = await this.deleteExpiredSessions(sessionCutoff);
    while (deleted === ANALYTICS_CLEANUP_BATCH_SIZE) {
      sessionsDeleted += deleted;
      deleted = await this.deleteExpiredSessions(sessionCutoff);
    }
    sessionsDeleted += deleted;

    deleted = await this.deleteRateLimitBuckets(rateLimitCutoff);
    while (deleted === ANALYTICS_CLEANUP_BATCH_SIZE) {
      rateLimitBucketsDeleted += deleted;
      deleted = await this.deleteRateLimitBuckets(rateLimitCutoff);
    }
    rateLimitBucketsDeleted += deleted;

    return { sessionsDeleted, rateLimitBucketsDeleted };
  }

  private async deleteExpiredSessions(cutoff: Date): Promise<number> {
    const rows = await prisma.$queryRaw<CleanupCountRow[]>`
      WITH candidates AS (
        SELECT "id"
        FROM "analytics_sessions"
        WHERE "expires_at" < ${cutoff}
          AND NOT EXISTS (
            SELECT 1
            FROM "analytics_events"
            WHERE "analytics_events"."session_id" = "analytics_sessions"."id"
          )
        ORDER BY "expires_at" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${ANALYTICS_CLEANUP_BATCH_SIZE}
      ), deleted AS (
        DELETE FROM "analytics_sessions"
        USING candidates
        WHERE "analytics_sessions"."id" = candidates."id"
        RETURNING "analytics_sessions"."id"
      )
      SELECT COUNT(*)::bigint AS "count" FROM deleted
    `;
    return this.toNumber(rows[0]?.count);
  }

  private async deleteRateLimitBuckets(cutoff: Date): Promise<number> {
    const rows = await prisma.$queryRaw<CleanupCountRow[]>`
      WITH candidates AS (
        SELECT "id"
        FROM "analytics_rate_limit_buckets"
        WHERE "updated_at" < ${cutoff}
        ORDER BY "updated_at" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${ANALYTICS_CLEANUP_BATCH_SIZE}
      ), deleted AS (
        DELETE FROM "analytics_rate_limit_buckets"
        USING candidates
        WHERE "analytics_rate_limit_buckets"."id" = candidates."id"
        RETURNING "analytics_rate_limit_buckets"."id"
      )
      SELECT COUNT(*)::bigint AS "count" FROM deleted
    `;
    return this.toNumber(rows[0]?.count);
  }

  private toNumber(value: bigint | number | string | undefined): number {
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string') return Number.parseInt(value, 10);
    return value ?? 0;
  }
}
