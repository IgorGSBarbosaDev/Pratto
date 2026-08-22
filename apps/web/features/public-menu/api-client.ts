import type { PublicMenuPageResponse, PublicMenuRelatedProductsResponse } from '@pratto/contracts';

import { publicRequest } from '../auth/api-client';

export const publicMenuApi = {
  getPage: (
    publicId: string,
    input: { cursor?: string; categoryId?: string; search?: string; limit?: number } = {},
  ) => {
    const params = new URLSearchParams();
    if (input.cursor) params.set('cursor', input.cursor);
    if (input.categoryId) params.set('categoryId', input.categoryId);
    if (input.search) params.set('search', input.search);
    params.set('limit', String(input.limit ?? 6));
    return publicRequest<PublicMenuPageResponse>(
      `/public/establishments/${encodeURIComponent(publicId)}/menu?${params.toString()}`,
    );
  },
  getRelated: (publicId: string, productId: string) =>
    publicRequest<PublicMenuRelatedProductsResponse>(
      `/public/establishments/${encodeURIComponent(publicId)}/menu/products/${encodeURIComponent(productId)}/related`,
    ),
};
