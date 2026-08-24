jest.mock('@pratto/config', () => ({ loadEnvironment: () => ({ COOKIE_SECRET: 'test-secret' }) }));
import { prisma } from '@pratto/database';

import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  let queryRaw: jest.SpyInstance;
  beforeEach(() => {
    queryRaw = jest
      .spyOn(prisma, '$queryRaw')
      .mockResolvedValue([{ count: 1, blockedUntil: null }]);
  });
  afterEach(() => jest.restoreAllMocks());

  it('allows an operation while the persisted bucket is below the limit', async () => {
    await expect(
      new RateLimitService().consume('login:ip', '192.0.2.1', 5, 60_000),
    ).resolves.toBeUndefined();
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(String(queryRaw.mock.calls[0][0])).toContain('auth_rate_limit_buckets');
    expect(String(queryRaw.mock.calls[0][0])).not.toContain('192.0.2.1');
  });

  it('returns a stable retry-after error when the bucket is blocked', async () => {
    queryRaw.mockResolvedValue([{ count: 6, blockedUntil: new Date(Date.now() + 30_000) }]);
    await expect(
      new RateLimitService().consume('login:ip', 'tracker', 5, 60_000),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
        details: { retryAfter: expect.any(Number) },
      }),
    });
  });
});
