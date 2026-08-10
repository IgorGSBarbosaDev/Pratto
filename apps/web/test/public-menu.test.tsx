import type { PublicMenuPageResponse } from '@pratto/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicMenuScreen } from '../features/public-menu/public-menu-screen';
import type { PublicMenuServerError } from '../features/public-menu/server-api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const publicId = 'establishment-public-id';
const categoryId = '11111111-1111-4111-8111-111111111111';
const dessertCategoryId = '22222222-2222-4222-8222-222222222222';
const intersectionObservers: Array<{
  callback: IntersectionObserverCallback;
  elements: Element[];
}> = [];

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
    menu: {
      name: 'Menu principal',
      publicationId: '33333333-3333-4333-8333-333333333333',
      version: 1,
      publishedAt: '2026-08-09T12:00:00.000Z',
    },
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

function renderScreen(
  props: {
    initialPage?: PublicMenuPageResponse;
    initialError?: PublicMenuServerError;
  } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicMenuScreen publicId={publicId} slug="casa-aurora" {...props} />
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

function analyticsResponse(input: RequestInfo | URL, status = 200) {
  const url = String(input);
  if (url.includes('/public/analytics/sessions')) {
    return response(
      {
        sessionId: '44444444-4444-4444-8444-444444444444',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
      status,
    );
  }
  return response({ results: [] }, status);
}

async function enterMenu() {
  fireEvent.click(await screen.findByRole('button', { name: 'Explorar o menu' }));
}

beforeEach(() => {
  intersectionObservers.length = 0;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      callback: IntersectionObserverCallback;
      elements: Element[] = [];

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        intersectionObservers.push(this);
      }

      observe(element: Element) {
        this.elements.push(element);
      }

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

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('PublicMenuScreen', () => {
  it('loads the published feed without making an authenticated request', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((input: RequestInfo | URL, options?: RequestInit) => {
        const url = String(input);
        if (url.includes('/public/analytics/')) return analyticsResponse(input);
        expect(url).toContain('/public/establishments/establishment-public-id/menu');
        expect(url).not.toContain('/admin/');
        expect(options?.credentials).toBe('omit');
        return response(page());
      });
    vi.stubGlobal('fetch', fetchMock);

    renderScreen();

    await enterMenu();
    expect(await screen.findByRole('heading', { name: 'Prato da casa' })).toBeInTheDocument();
    expect(screen.getByText('R$ 24,90')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pratos' })).toHaveAttribute('aria-pressed', 'false');
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/menu')).length).toBe(
      1,
    );
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
      if (url.pathname.includes('/public/analytics/')) return analyticsResponse(input);
      return response(url.searchParams.get('categoryId') === dessertCategoryId ? filtered : page());
    });
    vi.stubGlobal('fetch', fetchMock);

    renderScreen();
    await enterMenu();
    expect(await screen.findByRole('heading', { name: 'Prato da casa' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sobremesas' }));

    expect(await screen.findByRole('heading', { name: 'Torta da casa' })).toBeInTheDocument();
    expect(screen.getByText('Indisponível hoje')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Torta da casa');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/menu')).length).toBe(
      2,
    );
  });

  it('renders empty and not-published states', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input: RequestInfo | URL) =>
          String(input).includes('/public/analytics/')
            ? analyticsResponse(input)
            : response(page({ products: [] })),
        ),
    );
    renderScreen();
    await enterMenu();
    expect(
      await screen.findByRole('heading', { name: 'Nenhum prato disponível' }),
    ).toBeInTheDocument();

    cleanup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) =>
        String(input).includes('/public/analytics/')
          ? analyticsResponse(input)
          : response(
              {
                statusCode: 404,
                code: 'PUBLIC_MENU_NOT_PUBLISHED',
                message: 'Ainda não publicado.',
              },
              404,
            ),
      ),
    );
    renderScreen();
    expect(
      await screen.findByRole('heading', { name: 'Cardápio ainda não publicado' }),
    ).toBeInTheDocument();
  });

  it('hydrates the server snapshot, applies the public theme, and closes details with Escape', async () => {
    const serverPage = page({
      establishment: {
        ...page().establishment,
        theme: { mode: 'LIGHT', primaryColor: '#b45309' },
      },
    });
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('/public/analytics/sessions')) {
        return analyticsResponse(input);
      }
      return response({ results: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderScreen({ initialPage: serverPage });

    await enterMenu();
    expect(await screen.findByRole('heading', { name: 'Prato da casa' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('bg-sand');
    expect(screen.getByRole('main')).toHaveStyle('--menu-primary: #b45309');
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute('aria-label', 'Fechar');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/menu')).length).toBe(
      0,
    );
  });

  it('preserves a suspended state from the server without retrying automatically', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderScreen({
      initialError: {
        statusCode: 404,
        code: 'PUBLIC_MENU_SUSPENDED',
        message: 'Este cardápio está temporariamente indisponível.',
      },
    });

    expect(
      await screen.findByRole('heading', { name: 'Cardápio temporariamente indisponível' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts impression and qualified view only after their visibility timers', async () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeacon,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        if (String(input).includes('/public/analytics/sessions')) {
          return response({
            sessionId: '55555555-5555-4555-8555-555555555555',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          });
        }
        if (String(input).includes('/public/analytics/events')) return response({ results: [] });
        return response(page());
      }),
    );

    renderScreen();
    await enterMenu();
    expect(await screen.findByRole('heading', { name: 'Prato da casa' })).toBeInTheDocument();
    await waitFor(() => expect(intersectionObservers.length).toBeGreaterThanOrEqual(2));
    vi.useFakeTimers();
    const target = screen.getByRole('heading', { name: 'Prato da casa' }).closest('article');
    const analyticsObserver = intersectionObservers.at(-1);
    expect(target).not.toBeNull();
    expect(analyticsObserver).toBeDefined();

    analyticsObserver?.callback(
      [{ target, intersectionRatio: 0.6 } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    vi.advanceTimersByTime(499);
    expect(sendBeacon).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    analyticsObserver?.callback(
      [{ target, intersectionRatio: 0.8 } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    vi.advanceTimersByTime(1_999);
    expect(sendBeacon).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    window.dispatchEvent(new Event('pagehide'));
    await Promise.resolve();
    await Promise.resolve();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0]?.[0]).toContain('/public/analytics/events');
    vi.useRealTimers();
  });
});
