import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CategoryManagement } from '../features/catalog/category-management';
import { ProductManagement } from '../features/catalog/product-management';

const establishmentId = '11111111-1111-4111-8111-111111111111';
const menuId = '33333333-3333-4333-8333-333333333333';
const categoryId = '22222222-2222-4222-8222-222222222222';
const secondCategoryId = '66666666-6666-4666-8666-666666666666';
const productId = '44444444-4444-4444-8444-444444444444';
const secondProductId = '55555555-5555-4555-8555-555555555555';

const category = {
  id: categoryId,
  menuId,
  name: 'Lanches',
  description: null,
  displayOrder: 0,
  status: 'ACTIVE',
  archivedAt: null,
  createdAt: '2026-08-09T00:00:00.000Z',
  updatedAt: '2026-08-09T00:00:00.000Z',
};
const secondCategory = { ...category, id: secondCategoryId, name: 'Bebidas', displayOrder: 1 };
const product = {
  id: productId,
  menuId,
  categoryId,
  name: 'X-Burger',
  description: 'Pão, carne e queijo',
  price: '29.90',
  promotionalPrice: null,
  ingredients: null,
  allergens: null,
  availability: 'AVAILABLE',
  featured: false,
  status: 'ACTIVE',
  archivedAt: null,
  displayOrder: 0,
  createdAt: '2026-08-09T00:00:00.000Z',
  updatedAt: '2026-08-09T00:00:00.000Z',
};
const secondProduct = { ...product, id: secondProductId, name: 'Batata', displayOrder: 1 };

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function renderWithClient(element: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

describe('catalog management actions', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('deactivates, reorders and archives categories with confirmation', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/establishments/')) {
        return jsonResponse({
          establishmentId,
          menus: [{ id: menuId, name: 'Principal', status: 'DRAFT' }],
        });
      }
      if (options?.method === 'POST' && url.endsWith('/deactivate')) return jsonResponse(category);
      if (options?.method === 'POST' && url.endsWith('/archive')) return jsonResponse(category);
      if (options?.method === 'PATCH')
        return jsonResponse({ menuId, categories: [secondCategory, category] });
      return jsonResponse({ menuId, categories: [category, secondCategory] });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithClient(<CategoryManagement establishmentId={establishmentId} />);
    fireEvent.change(await screen.findByRole('combobox', { name: 'Menu alvo' }), {
      target: { value: menuId },
    });
    expect(await screen.findByText('Lanches')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Categoria Lanches ativa' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/categories/${categoryId}/deactivate`),
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    const moveDown = screen.getByRole('button', { name: 'Mover Lanches para baixo' });
    await waitFor(() => expect(moveDown).not.toBeDisabled());
    fireEvent.click(moveDown);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/categories/reorder'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ categoryIds: [secondCategoryId, categoryId] }),
        }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Arquivar Lanches' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Lanches');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Arquivar' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/categories/${categoryId}/archive`),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('filters products and protects status, reorder and archive actions behind mutations', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/establishments/')) {
        return jsonResponse({
          establishmentId,
          menus: [{ id: menuId, name: 'Principal', status: 'DRAFT' }],
        });
      }
      if (url.includes('/categories')) return jsonResponse({ menuId, categories: [category] });
      if (url.includes('/media')) return jsonResponse({ productId, media: [] });
      if (options?.method === 'POST' && url.endsWith('/deactivate')) return jsonResponse(product);
      if (options?.method === 'POST' && url.endsWith('/archive')) return jsonResponse(product);
      if (options?.method === 'PATCH')
        return jsonResponse({ menuId, products: [secondProduct, product] });
      return jsonResponse({ menuId, products: [product, secondProduct] });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithClient(<ProductManagement establishmentId={establishmentId} />);
    fireEvent.change(await screen.findByRole('combobox', { name: 'Menu alvo dos produtos' }), {
      target: { value: menuId },
    });
    expect(await screen.findByText('X-Burger')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar pratos' }), {
      target: { value: 'inexistente' },
    });
    expect(await screen.findByText('Nenhum prato encontrado')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar pratos' }), {
      target: { value: '' },
    });

    fireEvent.click(screen.getByRole('switch', { name: 'Produto X-Burger ativo' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/products/${productId}/deactivate`),
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    const moveDown = screen.getByRole('button', { name: 'Mover X-Burger para baixo' });
    await waitFor(() => expect(moveDown).not.toBeDisabled());
    fireEvent.click(moveDown);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/products/reorder'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ productIds: [secondProductId, productId] }),
        }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Arquivar X-Burger' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Arquivar' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/products/${productId}/archive`),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
