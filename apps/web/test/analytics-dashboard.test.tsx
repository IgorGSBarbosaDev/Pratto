import type { AnalyticsDashboardResponse } from '@pratto/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsDashboard } from '../features/analytics/analytics-dashboard';

const establishmentId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333';

function dashboardResponse(
  overrides: Partial<AnalyticsDashboardResponse> = {},
): AnalyticsDashboardResponse {
  return {
    period: {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-10T00:00:00.000Z',
    },
    summary: {
      sessions: 12,
      menuAccesses: 18,
      impressions: 25,
      qualifiedViews: 10,
      interactions: 4,
      contactClicks: 3,
      categoryViews: 7,
    },
    daily: [
      {
        day: '2026-08-08',
        sessions: 3,
        menuAccesses: 4,
        impressions: 6,
        qualifiedViews: 2,
        interactions: 1,
        contactClicks: 1,
        categoryViews: 2,
      },
      {
        day: '2026-08-09',
        sessions: 0,
        menuAccesses: 0,
        impressions: 0,
        qualifiedViews: 0,
        interactions: 0,
        contactClicks: 0,
        categoryViews: 0,
      },
    ],
    products: [
      {
        productId,
        name: 'Prato da casa',
        categoryId,
        categoryName: 'Pratos',
        impressions: 8,
        qualifiedViews: 5,
        interactions: 2,
      },
    ],
    categories: [{ categoryId, name: 'Pratos', views: 7 }],
    filters: {
      categories: [{ id: categoryId, name: 'Pratos' }],
      products: [{ id: productId, name: 'Prato da casa', categoryId, categoryName: 'Pratos' }],
    },
    ...overrides,
  };
}

function response(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AnalyticsDashboard establishmentId={establishmentId} />
    </QueryClientProvider>,
  );
}

afterEach(() => cleanup());

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(dashboardResponse())));
  });

  it('renders summary, rankings and daily evolution', async () => {
    renderDashboard();

    expect(await screen.findByText('Acessos ao cardápio')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Visão geral' })).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getAllByText('Cliques em contato')).toHaveLength(2);
    expect(screen.getByText('Produtos mais vistos')).toBeInTheDocument();
    expect(screen.getAllByText('Prato da casa')).toHaveLength(2);
    expect(screen.getByText('Evolução diária')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Métrica'), { target: { value: 'contactClicks' } });
    expect(screen.getByText('Cliques em contato por dia no período.')).toBeInTheDocument();
  });

  it('sends the selected period and category/product filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(dashboardResponse()));
    vi.stubGlobal('fetch', fetchMock);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Produtos mais vistos' });

    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: categoryId } });
    fireEvent.change(screen.getByLabelText('Produto'), { target: { value: productId } });
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '2026-08-09' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const requestUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(requestUrl.pathname).toBe(`/admin/establishments/${establishmentId}/analytics`);
    expect(requestUrl.searchParams.get('categoryId')).toBe(categoryId);
    expect(requestUrl.searchParams.get('productId')).toBe(productId);
    expect(requestUrl.searchParams.get('from')).toBe('2026-08-01T00:00:00.000Z');
    expect(requestUrl.searchParams.get('to')).toBe('2026-08-10T00:00:00.000Z');
  });

  it('shows loading and empty states', async () => {
    let resolveRequest: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
      ),
    );
    renderDashboard();
    expect(screen.getByRole('status', { name: 'Carregando analytics' })).toBeInTheDocument();

    resolveRequest?.(
      new Response(
        JSON.stringify(
          dashboardResponse({
            summary: {
              sessions: 0,
              menuAccesses: 0,
              impressions: 0,
              qualifiedViews: 0,
              interactions: 0,
              contactClicks: 0,
              categoryViews: 0,
            },
            products: [],
            categories: [],
          }),
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    expect(await screen.findByText('Ainda não há dados neste período')).toBeInTheDocument();
  });

  it('shows an error and retries the request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ code: 'ANALYTICS_UNAVAILABLE', message: 'Falha temporária.' }, 503),
      )
      .mockResolvedValueOnce(response(dashboardResponse()));
    vi.stubGlobal('fetch', fetchMock);
    renderDashboard();

    expect(await screen.findByText('Falha temporária.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Produtos mais vistos')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
