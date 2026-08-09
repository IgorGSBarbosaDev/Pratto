import type { PublicMenuPageResponse } from '@pratto/contracts';

import { publicRequest } from '../auth/api-client';

export const publicMenuApi = {
  getPage: (
    publicId: string,
    input: { cursor?: string; categoryId?: string; limit?: number } = {},
  ) => {
    const params = new URLSearchParams();
    if (input.cursor) params.set('cursor', input.cursor);
    if (input.categoryId) params.set('categoryId', input.categoryId);
    params.set('limit', String(input.limit ?? 6));
    return publicRequest<PublicMenuPageResponse>(
      `/public/establishments/${encodeURIComponent(publicId)}/menu?${params.toString()}`,
    );
  },
};
