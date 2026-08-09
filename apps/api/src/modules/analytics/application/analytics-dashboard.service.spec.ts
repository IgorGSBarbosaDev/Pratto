import type { AnalyticsDashboardQueryInput } from '@pratto/validation';

import { AnalyticsDashboardService } from './analytics-dashboard.service';

const establishmentId = '11111111-1111-4111-8111-111111111111';
const input: AnalyticsDashboardQueryInput = {
  from: '2026-08-01T00:00:00.000Z',
  to: '2026-08-10T00:00:00.000Z',
};

describe('AnalyticsDashboardService', () => {
  it('rejects an establishment outside the resolved tenant', async () => {
    const queryService = {
      summary: jest.fn(),
      daily: jest.fn(),
      products: jest.fn(),
      categories: jest.fn(),
    };
    const service = new AnalyticsDashboardService(queryService as never);

    await expect(
      service.getDashboard(
        { organizationId: '22222222-2222-4222-8222-222222222222', establishmentIds: [] } as never,
        establishmentId,
        input,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ESTABLISHMENT_NOT_FOUND' },
    });
    expect(queryService.summary).not.toHaveBeenCalled();
  });
});
