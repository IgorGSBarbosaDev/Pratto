import type { AnalyticsDashboardQuery, AnalyticsDashboardResponse } from '@pratto/contracts';

import { request } from '../auth/api-client';

export const analyticsApi = {
  getDashboard: (establishmentId: string, query: AnalyticsDashboardQuery) => {
    const params = new URLSearchParams({ fromDate: query.fromDate, toDate: query.toDate });
    if (query.categoryId) params.set('categoryId', query.categoryId);
    if (query.productId) params.set('productId', query.productId);
    return request<AnalyticsDashboardResponse>(
      `/admin/establishments/${establishmentId}/analytics?${params.toString()}`,
    );
  },
};
