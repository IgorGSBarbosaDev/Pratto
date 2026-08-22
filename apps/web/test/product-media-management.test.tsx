import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('confirms media removal and keeps the destructive request behind the dialog', async () => {
    document.cookie = 'pratto_csrf=test-csrf';
    let removed = false;
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'DELETE') {
        removed = true;
        return Promise.resolve(
          new Response(JSON.stringify({ productId: 'product-id', media: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            productId: 'product-id',
            media: removed
              ? []
              : [
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
    });
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <ProductMediaManagement menuId="menu-id" productId="product-id" />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Remover mídia?' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Remover' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(removed).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remover' }),
    );
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(true),
    );
    expect(
      await screen.findByText('Nenhuma mídia cadastrada para este produto.'),
    ).toBeInTheDocument();
  });
});
