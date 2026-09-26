import { prisma } from '@pratto/database';
import type { AnalyticsDashboardQueryInput } from '@pratto/validation';

import type { TenantPrincipal } from '../../identity/domain/auth.types';

import { AnalyticsDashboardService } from './analytics-dashboard.service';

const establishmentId = '11111111-1111-4111-8111-111111111111';
const organizationId = '22222222-2222-4222-8222-222222222222';
const input: AnalyticsDashboardQueryInput = {
  fromDate: '2026-08-01',
  toDate: '2026-08-10',
};
const tenant = (role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER'): TenantPrincipal => ({
  sessionId: 'session-id',
  userId: 'user-id',
  rawToken: 'token',
  expiresAt: new Date('2026-08-01T00:00:00.000Z'),
  renewed: false,
  membershipId: 'membership-id',
  organizationId,
  role,
  establishmentIds: [establishmentId],
});

describe('AnalyticsDashboardService behavior', () => {
  const queryService = {
    summary: jest.fn(),
    daily: jest.fn(),
    products: jest.fn(),
    categories: jest.fn(),
  };
  let service: AnalyticsDashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsDashboardService(queryService as never);
    jest
      .spyOn(prisma.establishment, 'findFirst')
      .mockResolvedValue({ id: establishmentId, timeZone: 'America/Sao_Paulo' } as never);
    jest.spyOn(prisma.category, 'findFirst').mockResolvedValue({ id: 'category-id' } as never);
    jest
      .spyOn(prisma.product, 'findFirst')
      .mockResolvedValue({ id: 'product-id', categoryId: 'category-id' } as never);
    jest
      .spyOn(prisma.category, 'findMany')
      .mockResolvedValue([{ id: 'category-id', name: 'Pratos' }] as never);
    jest.spyOn(prisma.product, 'findMany').mockResolvedValue([
      {
        id: 'product-id',
        name: 'Prato',
        categoryId: 'category-id',
        category: { name: 'Pratos' },
      },
    ] as never);
    queryService.summary.mockResolvedValue({
      sessions: 1,
      menuAccesses: 2,
      impressions: 3,
      qualifiedViews: 4,
      interactions: 5,
      contactClicks: 6,
      categoryViews: 7,
    });
    queryService.daily.mockResolvedValue([]);
    queryService.products.mockResolvedValue([
      { productId: 'product-id', impressions: 3, qualifiedViews: 2, interactions: 1 },
      { productId: 'missing-product', impressions: 1, qualifiedViews: 0, interactions: 0 },
    ]);
    queryService.categories.mockResolvedValue([
      { categoryId: 'category-id', views: 3 },
      { categoryId: 'missing-category', views: 1 },
    ]);
  });

  afterEach(() => jest.restoreAllMocks());

  it('builds a dashboard with tenant-scoped filters and fallback labels for stale metrics', async () => {
    await expect(
      service.getDashboard(tenant(), establishmentId, { ...input, categoryId: 'category-id' }),
    ).resolves.toMatchObject({
      period: { from: '2026-08-01T03:00:00.000Z', to: '2026-08-11T03:00:00.000Z' },
      summary: { sessions: 1 },
      products: [
        { productId: 'product-id', name: 'Prato', categoryName: 'Pratos' },
        {
          productId: 'missing-product',
          name: 'Produto não encontrado',
          categoryName: 'Categoria não encontrada',
        },
      ],
      categories: [
        { categoryId: 'category-id', name: 'Pratos' },
        { categoryId: 'missing-category', name: 'Categoria não encontrada' },
      ],
      filters: { categories: [{ id: 'category-id', name: 'Pratos' }] },
    });
    expect(queryService.summary).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId, establishmentId, categoryId: 'category-id' }),
    );
  });

  it('blocks members and rejects cross-establishment category/product filters', async () => {
    await expect(
      service.getDashboard(tenant('MEMBER'), establishmentId, input),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PERMISSION_DENIED', statusCode: 403 }),
    });
    expect(queryService.summary).not.toHaveBeenCalled();

    (prisma.category.findFirst as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      service.getDashboard(tenant(), establishmentId, { ...input, categoryId: 'other-category' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ANALYTICS_FILTER_INVALID' }),
    });
    (prisma.product.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'product-id',
      categoryId: 'other-category',
    });
    await expect(
      service.getDashboard(tenant(), establishmentId, {
        ...input,
        categoryId: 'category-id',
        productId: 'product-id',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ANALYTICS_FILTER_INVALID' }),
    });
  });
});
