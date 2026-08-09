import { createHmac } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { loadEnvironment } from '@pratto/config';
import { prisma } from '@pratto/database';

import { StableHttpException } from '../../../common/http/stable-http.exception';

interface RateLimitRow {
  count: number;
  blockedUntil: Date | null;
}

const RATE_LIMIT_WINDOW_MS = 60_000;

@Injectable()
export class AnalyticsRateLimitService {
  private readonly environment = loadEnvironment();

  async consume(
    action: string,
    tracker: string,
    limit: number,
    increment = 1,
    windowMs = RATE_LIMIT_WINDOW_MS,
  ): Promise<void> {
    const trackerHash = createHmac('sha256', this.environment.COOKIE_SECRET)
      .update(`analytics-rate-limit:${tracker}`)
      .digest('hex');
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    const blockedUntil = new Date(now.getTime() + windowMs);
    const rows = await prisma.$queryRaw<RateLimitRow[]>`
      INSERT INTO "analytics_rate_limit_buckets"
        ("action", "tracker_hash", "window_started_at", "count", "blocked_until", "created_at", "updated_at")
      VALUES (${action}, ${trackerHash}, ${now}, ${increment}, NULL, ${now}, ${now})
      ON CONFLICT ("action", "tracker_hash") DO UPDATE SET
        "count" = CASE
          WHEN "analytics_rate_limit_buckets"."window_started_at" <= ${windowStart} THEN ${increment}
          ELSE "analytics_rate_limit_buckets"."count" + ${increment}
        END,
        "window_started_at" = CASE
          WHEN "analytics_rate_limit_buckets"."window_started_at" <= ${windowStart} THEN ${now}
          ELSE "analytics_rate_limit_buckets"."window_started_at"
        END,
        "blocked_until" = CASE
          WHEN "analytics_rate_limit_buckets"."blocked_until" > ${now}
            THEN "analytics_rate_limit_buckets"."blocked_until"
          WHEN "analytics_rate_limit_buckets"."window_started_at" <= ${windowStart} THEN NULL
          WHEN "analytics_rate_limit_buckets"."count" + ${increment} > ${limit} THEN ${blockedUntil}
          ELSE NULL
        END,
        "updated_at" = ${now}
      RETURNING "count", "blocked_until" AS "blockedUntil"
    `;
    const bucket = rows[0];
    if (!bucket?.blockedUntil || bucket.blockedUntil <= now) return;

    const retryAfter = Math.max(
      1,
      Math.ceil((bucket.blockedUntil.getTime() - now.getTime()) / 1000),
    );
    throw new StableHttpException(
      HttpStatus.TOO_MANY_REQUESTS,
      'ANALYTICS_RATE_LIMIT_EXCEEDED',
      'O volume de analytics excedeu o limite temporário.',
      { retryAfter },
    );
  }
}
