jest.mock('@pratto/config', () => ({ loadEnvironment: () => ({ COOKIE_SECRET: 'test-secret' }) }));
import { prisma } from '@pratto/database';

import { AnalyticsRateLimitService } from './analytics-rate-limit.service';

describe('AnalyticsRateLimitService', () => {
  let queryRaw: jest.SpyInstance;
  beforeEach(() => {
    queryRaw = jest
      .spyOn(prisma, '$queryRaw')
      .mockResolvedValue([{ count: 1, blockedUntil: null }]);
  });
  afterEach(() => jest.restoreAllMocks());

  it('supports weighted event increments without persisting raw trackers', async () => {
    await expect(
      new AnalyticsRateLimitService().consume(
        'analytics-events-session',
        'session-id',
        300,
        4,
        60_000,
      ),
    ).resolves.toBeUndefined();
    expect(String(queryRaw.mock.calls[0][0])).toContain('analytics_rate_limit_buckets');
    expect(String(queryRaw.mock.calls[0][0])).not.toContain('session-id');
  });

  it('rejects an exhausted analytics bucket with a separate stable error code', async () => {
    queryRaw.mockResolvedValue([{ count: 61, blockedUntil: new Date(Date.now() + 10_000) }]);
    await expect(
      new AnalyticsRateLimitService().consume('analytics-ingest-ip', 'tracker', 60),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ANALYTICS_RATE_LIMIT_EXCEEDED', statusCode: 429 }),
    });
  });
});
