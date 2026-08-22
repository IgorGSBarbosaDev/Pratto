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
    initialProductId?: string;
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

  it('renders contact links and sends anonymous contact events without contact data', async () => {
    const events: unknown[] = [];
    const contactPage = page({
      establishment: {
        ...page().establishment,
        phone: '+55 (31) 99999-8888',
        whatsapp: '+55 (31) 98888-7777',
      },
    });
    const fetchMock = vi
      .fn()
      .mockImplementation((input: RequestInfo | URL, options?: RequestInit) => {
        const url = String(input);
        if (url.includes('/public/analytics/sessions')) return analyticsResponse(input);
        if (url.includes('/public/analytics/events')) {
          const body = JSON.parse(String(options?.body)) as { events: unknown[] };
          events.push(...body.events);
          return response({ results: [] });
        }
        return response(contactPage);
      });
    vi.stubGlobal('fetch', fetchMock);

    renderScreen({ initialPage: contactPage });
    await enterMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurante' }));

    const phone = screen.getByRole('link', { name: /Telefone/ });
    const whatsapp = screen.getByRole('link', { name: /WhatsApp/ });
    expect(phone).toHaveAttribute('href', 'tel:+5531999998888');
    expect(whatsapp).toHaveAttribute('href', 'https://wa.me/5531988887777');

    phone.addEventListener('click', (event) => event.preventDefault());
    whatsapp.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(phone);
    fireEvent.click(whatsapp);

    await waitFor(() =>
      expect(
        events.filter((event) => (event as { eventType?: string }).eventType === 'contact_clicked'),
      ).toHaveLength(2),
    );
    const contactEvents = events.filter(
      (event) => (event as { eventType?: string }).eventType === 'contact_clicked',
    );
    expect(contactEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: 'contact_clicked', contactType: 'phone' }),
        expect.objectContaining({ eventType: 'contact_clicked', contactType: 'whatsapp' }),
      ]),
    );
    expect(JSON.stringify(contactEvents)).not.toContain('99999');
    expect(JSON.stringify(contactEvents)).not.toContain('88888');
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
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/menu')).length).toBe(
      0,
    );
  });

  it('opens a compact share sheet and copies the direct product URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input: RequestInfo | URL) =>
          String(input).includes('/public/analytics/')
            ? analyticsResponse(input)
            : response(page()),
        ),
    );

    renderScreen({ initialPage: page() });
    await enterMenu();
    const shareButton = await screen.findByRole('button', { name: 'Compartilhar Prato da casa' });
    fireEvent.click(shareButton);

    const dialog = screen.getByRole('dialog', { name: 'Compartilhar prato' });
    expect(dialog).toHaveTextContent('Prato da casa');
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp' });
    const twitter = screen.getByRole('link', { name: 'Twitter / X' });
    expect(new URL(whatsapp.getAttribute('href')!).searchParams.get('text')).toContain(
      'http://localhost:3000/menu/establishment-public-id/casa-aurora?product=product-1',
    );
    expect(new URL(twitter.getAttribute('href')!).searchParams.get('url')).toBe(
      'http://localhost:3000/menu/establishment-public-id/casa-aurora?product=product-1',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'http://localhost:3000/menu/establishment-public-id/casa-aurora?product=product-1',
      ),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Link do prato copiado.');
  });

  it('uses native sharing for Instagram and falls back to copying when unavailable', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: nativeShare });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input: RequestInfo | URL) =>
          String(input).includes('/public/analytics/')
            ? analyticsResponse(input)
            : response(page()),
        ),
    );

    renderScreen({ initialPage: page() });
    await enterMenu();
    fireEvent.click(await screen.findByRole('button', { name: 'Compartilhar Prato da casa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));
    await waitFor(() =>
      expect(nativeShare).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Prato da casa no Casa Aurora',
          url: 'http://localhost:3000/menu/establishment-public-id/casa-aurora?product=product-1',
        }),
      ),
    );

    cleanup();
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    renderScreen({ initialPage: page() });
    await enterMenu();
    fireEvent.click(await screen.findByRole('button', { name: 'Compartilhar Prato da casa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Link copiado — cole no Instagram.',
    );
  });

  it('loads paginated products and positions a direct product link in the feed', async () => {
    const first = page({ nextCursor: 'next-product-page' });
    const targetProduct = {
      ...first.products[0]!,
      id: 'product-2',
      name: 'Prato compartilhado',
    };
    const second = page({ products: [targetProduct], nextCursor: null });
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/public/analytics/')) return analyticsResponse(input);
      return response(url.includes('cursor=next-product-page') ? second : first);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderScreen({ initialPage: first, initialProductId: targetProduct.id });

    expect(screen.queryByRole('button', { name: 'Explorar o menu' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Prato compartilhado' })).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('cursor=next-product-page')),
    ).toBe(true);
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
