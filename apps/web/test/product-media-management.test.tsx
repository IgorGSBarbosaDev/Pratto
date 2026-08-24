import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProductMediaManagement } from '../features/catalog/product-media-management';

const mediaUrl = 'http://localhost:9000/pratto-local/product-media/item.png';
const menuId = '33333333-3333-4333-8333-333333333333';
const productId = '22222222-2222-4222-8222-222222222222';
const firstId = '44444444-4444-4444-8444-444444444444';
const secondId = '55555555-5555-4555-8555-555555555555';

const media = [
  {
    id: firstId,
    productId,
    mediaType: 'IMAGE',
    url: 'https://cdn.example.com/first.png',
    originalName: 'first.png',
    mimeType: 'image/png',
    sizeBytes: 100,
    displayOrder: 0,
    isPrimary: true,
    createdAt: '2026-08-09T00:00:00.000Z',
  },
  {
    id: secondId,
    productId,
    mediaType: 'VIDEO',
    url: 'https://cdn.example.com/second.mp4',
    originalName: 'second.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 200,
    displayOrder: 1,
    isPrimary: false,
    createdAt: '2026-08-09T00:00:00.000Z',
  },
];

function renderMedia(canManage = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProductMediaManagement menuId={menuId} productId={productId} canManage={canManage} />
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

describe('ProductMediaManagement', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

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

  it('keeps all mutations unavailable to read-only members', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ menuId, productId, media }));
    vi.stubGlobal('fetch', fetchMock);

    renderMedia(false);

    expect(await screen.findByText('2 arquivos')).toBeInTheDocument();
    expect(screen.getAllByText('Somente leitura')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /enviar mídia/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /definir principal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remover/i })).not.toBeInTheDocument();
  });

  it('uploads, promotes, reorders and removes media through explicit actions', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return jsonResponse(media[1]);
      if (options?.method === 'PATCH') return jsonResponse(undefined);
      if (options?.method === 'DELETE') return jsonResponse(undefined, 204);
      return jsonResponse({ menuId, productId, media });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderMedia();
    expect(await screen.findByText('2 arquivos')).toBeInTheDocument();

    const file = new File(['image'], 'new.png', { type: 'image/png' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /enviar mídia/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/products/${productId}/media`),
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      ),
    );

    const primaryButton = screen
      .getAllByRole('button', { name: /definir principal/i })
      .find((button) => !button.hasAttribute('disabled'))!;
    await waitFor(() => expect(primaryButton).not.toBeDisabled());
    fireEvent.click(primaryButton);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/media/${secondId}/primary`),
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: `Mover second.mp4 para cima` }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/products/${productId}/media/reorder`),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ mediaIds: [secondId, firstId] }),
        }),
      ),
    );

    const secondCard = screen.getByText('second.mp4').closest('article')!;
    fireEvent.click(within(secondCard).getByRole('button', { name: 'Remover' }));
    const removalDialog = screen.getByRole('alertdialog');
    expect(removalDialog).toHaveTextContent('second.mp4');
    fireEvent.click(within(removalDialog).getByRole('button', { name: 'Remover' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/media/${secondId}`),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('shows dependency errors without hiding the media controls', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ code: 'STORAGE_UNAVAILABLE', message: 'Armazenamento indisponível' }, 503),
      );
    vi.stubGlobal('fetch', fetchMock);

    renderMedia();

    expect(await screen.findByRole('alert')).toHaveTextContent('Armazenamento indisponível');
    expect(screen.getByRole('button', { name: /enviar mídia/i })).toBeInTheDocument();
  });
});
