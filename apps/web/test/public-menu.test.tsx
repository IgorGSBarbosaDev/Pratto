import type { PublicMenuPageResponse } from '@pratto/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicMenuScreen } from '../features/public-menu/public-menu-screen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const publicId = 'establishment-public-id';
const categoryId = '11111111-1111-4111-8111-111111111111';
const dessertCategoryId = '22222222-2222-4222-8222-222222222222';

function page(overrides: Partial<PublicMenuPageResponse> = {}): PublicMenuPageResponse {
  return {
    establishment: {
      publicId,
      name: 'Casa Aurora',
      slug: 'casa-aurora',
      description: 'Comida feita na hora',
      phone: null,
      whatsapp: null,
      address: null,
      operatingHours: {} as PublicMenuPageResponse['establishment']['operatingHours'],
      logo: null,
      coverImage: null,
      theme: { mode: 'DARK', primaryColor: '#166534' },
    },
    menu: { name: 'Menu principal', version: 1, publishedAt: '2026-08-09T12:00:00.000Z' },
    categories: [
      { id: categoryId, name: 'Pratos', description: null },
      { id: dessertCategoryId, name: 'Sobremesas', description: null },
    ],
    products: [
      {
        id: 'product-1',
        categoryId,
        name: 'Prato da casa',
        description: 'Arroz, feijão e acompanhamento.',
        price: '29.90',
        promotionalPrice: '24.90',
        ingredients: 'Arroz e feijão',
        allergens: 'Pode conter leite',
        availability: 'AVAILABLE',
        featured: true,
        media: [
          { id: 'media-1', mediaType: 'IMAGE', contentType: 'image/png', url: '/dish.png' },
          { id: 'media-2', mediaType: 'IMAGE', contentType: 'image/png', url: '/dish-2.png' },
        ],
      },
    ],
    nextCursor: null,
    ...overrides,
  };
}

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicMenuScreen publicId={publicId} slug="casa-aurora" />
    </QueryClientProvider>,
  );
}

function response(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => cleanup());

describe('PublicMenuScreen', () => {
  it('loads the published feed without making an authenticated request', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((input: RequestInfo | URL, options?: RequestInit) => {
        const url = String(input);
        expect(url).toContain('/public/establishments/establishment-public-id/menu');
        expect(url).not.toContain('/admin/');
        expect(options?.credentials).toBe('omit');
        return response(page());
      });
    vi.stubGlobal('fetch', fetchMock);

    renderScreen();

    expect(await screen.findByRole('heading', { name: 'Prato da casa' })).toBeInTheDocument();
    expect(screen.getByText('R$ 24,90')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pratos' })).toHaveAttribute('aria-pressed', 'false');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('filters categories, supports media details, and shows temporary unavailability', async () => {
    const filtered = page({
      products: [
        {
          ...page().products[0]!,
          id: 'dessert-1',
          categoryId: dessertCategoryId,
          name: 'Torta da casa',
          availability: 'TEMPORARILY_UNAVAILABLE',
          media: [],
        },
      ],
    });
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input));
      return response(url.searchParams.get('categoryId') === dessertCategoryId ? filtered : page());
    });
    vi.stubGlobal('fetch', fetchMock);

    renderScreen();
    expect(await screen.findByRole('heading', { name: 'Prato da casa' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sobremesas' }));

    expect(await screen.findByRole('heading', { name: 'Torta da casa' })).toBeInTheDocument();
    expect(screen.getByText('Indisponível no momento')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Torta da casa');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renders empty and not-published states', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(response(page({ products: [] }))));
    renderScreen();
    expect(
      await screen.findByRole('heading', { name: 'Nenhum produto disponível' }),
    ).toBeInTheDocument();

    cleanup();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockReturnValue(
          response(
            { statusCode: 404, code: 'PUBLIC_MENU_NOT_PUBLISHED', message: 'Ainda não publicado.' },
            404,
          ),
        ),
    );
    renderScreen();
    expect(
      await screen.findByRole('heading', { name: 'Cardápio ainda não publicado' }),
    ).toBeInTheDocument();
  });
});
