import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProductMediaManagement } from '../features/catalog/product-media-management';

const mediaUrl = 'http://localhost:9000/pratto-local/product-media/item.png';

describe('ProductMediaManagement', () => {
  it('loads and previews image media with primary state and controls', async () => {
    document.cookie = 'pratto_csrf=test-csrf';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          productId: 'product-id',
          media: [
            {
              id: 'media-id',
              productId: 'product-id',
              mediaType: 'IMAGE',
              contentType: 'image/png',
              originalName: 'produto.png',
              url: mediaUrl,
              sizeBytes: 8,
              displayOrder: 0,
              isPrimary: true,
              createdAt: '2026-08-09T00:00:00.000Z',
              updatedAt: '2026-08-09T00:00:00.000Z',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <ProductMediaManagement menuId="menu-id" productId="product-id" />
      </QueryClientProvider>,
    );

    expect(await screen.findByAltText('produto.png')).toHaveAttribute('src', mediaUrl);
    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Definir principal' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remover' })).toBeEnabled();
  });
});
