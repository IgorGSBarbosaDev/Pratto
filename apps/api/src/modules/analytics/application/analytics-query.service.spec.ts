import { prisma } from '@pratto/database';

import { AnalyticsQueryService } from './analytics-query.service';

const scope = {
  organizationId: 'organization-id',
  establishmentId: 'establishment-id',
  from: new Date('2026-08-01T00:00:00.000Z'),
  to: new Date('2026-08-03T00:00:00.000Z'),
};

describe('AnalyticsQueryService', () => {
  let queryRaw: jest.SpyInstance;
  let service: AnalyticsQueryService;

  beforeEach(() => {
    queryRaw = jest.spyOn(prisma, '$queryRaw').mockResolvedValue([]);
    service = new AnalyticsQueryService();
  });

  afterEach(() => jest.restoreAllMocks());

  it('converts bigint and empty aggregate rows into a stable summary', async () => {
    queryRaw.mockResolvedValueOnce([
      {
        sessions: 3n,
        menuAccesses: 4n,
        impressions: 5n,
        qualifiedViews: 6n,
        interactions: 7n,
        contactClicks: 8n,
        categoryViews: 9n,
      },
    ]);
    await expect(service.summary(scope)).resolves.toEqual({
      sessions: 3,
      menuAccesses: 4,
      impressions: 5,
      qualifiedViews: 6,
      interactions: 7,
      contactClicks: 8,
      categoryViews: 9,
    });
    queryRaw.mockResolvedValueOnce([]);
    await expect(service.summary(scope)).resolves.toEqual({
      sessions: 0,
      menuAccesses: 0,
      impressions: 0,
      qualifiedViews: 0,
      interactions: 0,
      contactClicks: 0,
      categoryViews: 0,
    });
  });

  it('maps daily, product and category metrics with deterministic primitive values', async () => {
    queryRaw
      .mockResolvedValueOnce([
        {
          day: new Date('2026-08-01T00:00:00.000Z'),
          sessions: 1n,
          menuAccesses: 2n,
          impressions: 3n,
          qualifiedViews: 4n,
          interactions: 5n,
          contactClicks: 6n,
          categoryViews: 7n,
        },
      ])
      .mockResolvedValueOnce([
        { productId: 'product-id', impressions: 2n, qualifiedViews: 3n, interactions: 4n },
      ])
      .mockResolvedValueOnce([{ categoryId: 'category-id', views: 5n }]);
    await expect(service.daily(scope)).resolves.toEqual([
      {
        day: '2026-08-01',
        sessions: 1,
        menuAccesses: 2,
        impressions: 3,
        qualifiedViews: 4,
        interactions: 5,
        contactClicks: 6,
        categoryViews: 7,
      },
    ]);
    await expect(
      service.products({ ...scope, categoryId: 'category-id', productId: 'product-id' }),
    ).resolves.toEqual([
      { productId: 'product-id', impressions: 2, qualifiedViews: 3, interactions: 4 },
    ]);
    await expect(service.categories(scope)).resolves.toEqual([
      { categoryId: 'category-id', views: 5 },
    ]);
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });
});
