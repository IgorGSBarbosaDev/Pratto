import { prisma } from '@pratto/database';

import {
  ANALYTICS_CLEANUP_BATCH_SIZE,
  ANALYTICS_CLEANUP_INTERVAL_MS,
  ANALYTICS_RATE_LIMIT_RETENTION_MS,
  ANALYTICS_SESSION_RETENTION_MS,
  AnalyticsRetentionService,
} from './analytics-retention.service';

describe('AnalyticsRetentionService', () => {
  let queryRaw: jest.SpyInstance;

  beforeEach(() => {
    queryRaw = jest.spyOn(prisma, '$queryRaw').mockResolvedValue([{ count: 0n }]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('uses a bounded MVP retention policy without deleting analytic events', async () => {
    queryRaw
      .mockResolvedValueOnce([{ count: BigInt(ANALYTICS_CLEANUP_BATCH_SIZE) }])
      .mockResolvedValueOnce([{ count: 2n }])
      .mockResolvedValueOnce([{ count: 3n }]);

    const service = new AnalyticsRetentionService();
    const result = await service.cleanup(new Date('2026-08-09T12:00:00.000Z'));

    expect(result).toEqual({
      sessionsDeleted: ANALYTICS_CLEANUP_BATCH_SIZE + 2,
      rateLimitBucketsDeleted: 3,
    });
    expect(queryRaw).toHaveBeenCalledTimes(3);
    const sessionQuery = String(queryRaw.mock.calls[0]?.[0]);
    expect(sessionQuery).toContain('NOT EXISTS');
    expect(sessionQuery).not.toContain('DELETE FROM "analytics_events"');
  });

  it('coalesces overlapping cleanup runs', async () => {
    let firstCall = true;
    let resolveFirstQuery: (() => void) | undefined;
    queryRaw.mockImplementation(() => {
      if (!firstCall) return Promise.resolve([{ count: 0n }]);
      firstCall = false;
      return new Promise((resolve) => {
        resolveFirstQuery = () => resolve([{ count: 0n }]);
      });
    });

    const service = new AnalyticsRetentionService();
    const first = service.cleanup();
    const second = service.cleanup();

    expect(first).toBe(second);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    resolveFirstQuery?.();
    await expect(first).resolves.toEqual({ sessionsDeleted: 0, rateLimitBucketsDeleted: 0 });
  });

  it('schedules periodic cleanup and stops after module destruction', () => {
    jest.useFakeTimers();
    const service = new AnalyticsRetentionService();
    const cleanup = jest.spyOn(service, 'cleanup').mockResolvedValue({
      sessionsDeleted: 0,
      rateLimitBucketsDeleted: 0,
    });

    service.onModuleInit();
    jest.advanceTimersByTime(ANALYTICS_CLEANUP_INTERVAL_MS);
    expect(cleanup).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
    jest.advanceTimersByTime(ANALYTICS_CLEANUP_INTERVAL_MS * 2);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('keeps the retention windows explicit and reviewable', () => {
    expect(ANALYTICS_SESSION_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(ANALYTICS_RATE_LIMIT_RETENTION_MS).toBe(2 * 60 * 60 * 1000);
  });
});
