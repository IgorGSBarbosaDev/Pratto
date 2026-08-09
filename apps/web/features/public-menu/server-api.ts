import type { ApiError, PublicMenuPageResponse } from '@pratto/contracts';
import { cache } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface PublicMenuServerError {
  statusCode: number;
  code: string;
  message: string;
}

export interface PublicMenuServerResult {
  page?: PublicMenuPageResponse;
  error?: PublicMenuServerError;
}

export const fetchPublicMenuPage = cache(
  async (publicId: string, limit = 6): Promise<PublicMenuServerResult> => {
    const params = new URLSearchParams({ limit: String(limit) });
    try {
      const response = await fetch(
        `${API_URL}/public/establishments/${encodeURIComponent(publicId)}/menu?${params.toString()}`,
        { cache: 'no-store' },
      );
      if (!response.ok) {
        const error = (await response.json().catch(() => undefined)) as ApiError | undefined;
        return {
          error: {
            statusCode: response.status,
            code: error?.code ?? 'PUBLIC_MENU_UNAVAILABLE',
            message: error?.message ?? 'Não foi possível carregar este cardápio.',
          },
        };
      }
      return { page: (await response.json()) as PublicMenuPageResponse };
    } catch {
      return {
        error: {
          statusCode: 503,
          code: 'PUBLIC_MENU_UNAVAILABLE',
          message: 'Não foi possível conectar ao cardápio agora.',
        },
      };
    }
  },
);
