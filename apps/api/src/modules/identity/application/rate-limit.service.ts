import { HttpStatus, Injectable } from '@nestjs/common';
import { loadEnvironment } from '@pratto/config';
import { prisma } from '@pratto/database';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import { keyedHash } from '../domain/auth.crypto';

interface RateLimitRow {
  count: number;
  blockedUntil: Date | null;
}

@Injectable()
export class RateLimitService {
  private readonly environment = loadEnvironment();

  async consume(action: string, tracker: string, limit: number, windowMs: number): Promise<void> {
    const trackerHash = keyedHash(this.environment.COOKIE_SECRET, 'rate-limit', tracker);
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    const blockedUntil = new Date(now.getTime() + windowMs);
    const rows = await prisma.$queryRaw<RateLimitRow[]>`
      INSERT INTO "auth_rate_limit_buckets"
        ("action", "tracker_hash", "window_started_at", "count", "blocked_until", "created_at", "updated_at")
      VALUES (${action}, ${trackerHash}, ${now}, 1, NULL, ${now}, ${now})
      ON CONFLICT ("action", "tracker_hash") DO UPDATE SET
        "count" = CASE
          WHEN "auth_rate_limit_buckets"."window_started_at" <= ${windowStart} THEN 1
          ELSE "auth_rate_limit_buckets"."count" + 1
        END,
        "window_started_at" = CASE
          WHEN "auth_rate_limit_buckets"."window_started_at" <= ${windowStart} THEN ${now}
          ELSE "auth_rate_limit_buckets"."window_started_at"
        END,
        "blocked_until" = CASE
          WHEN "auth_rate_limit_buckets"."blocked_until" > ${now}
            THEN "auth_rate_limit_buckets"."blocked_until"
          WHEN "auth_rate_limit_buckets"."window_started_at" <= ${windowStart} THEN NULL
          WHEN "auth_rate_limit_buckets"."count" + 1 > ${limit} THEN ${blockedUntil}
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
      'RATE_LIMIT_EXCEEDED',
      'Muitas tentativas. Tente novamente mais tarde.',
      { retryAfter },
    );
  }
}
