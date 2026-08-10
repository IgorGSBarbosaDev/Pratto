import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProductManagement } from '../features/catalog/product-management';

const menuId = '33333333-3333-4333-8333-333333333333';
const categoryId = '22222222-2222-4222-8222-222222222222';

function renderWithQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProductManagement establishmentId="11111111-1111-4111-8111-111111111111" />
    </QueryClientProvider>,
  );
}

describe('ProductManagement', () => {
  it('requires an explicit menu and loads products with its categories', async () => {
    document.cookie = 'pratto_csrf=test-csrf';
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/establishments/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              establishmentId: '11111111-1111-4111-8111-111111111111',
              menus: [{ id: menuId, name: 'Menu principal', status: 'DRAFT' }],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      if (url.includes('/categories')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              menuId,
              categories: [
                {
                  id: categoryId,
                  menuId,
                  name: 'Lanches',
                  description: null,
                  displayOrder: 0,
                  status: 'ACTIVE',
                  archivedAt: null,
                  createdAt: '2026-08-09T00:00:00.000Z',
                  updatedAt: '2026-08-09T00:00:00.000Z',
                },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ menuId, products: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient();

    expect(
      await screen.findByText('Selecione explicitamente o menu que deseja gerenciar.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Nenhum produto cadastrado.')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Menu alvo dos produtos' }), {
      target: { value: menuId },
    });
    expect(await screen.findByText('Nenhum produto cadastrado.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Novo prato' }));
    expect(screen.getByRole('option', { name: 'Lanches' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /Nome do prato/ }), {
      target: { value: 'X-Burger' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Preço \(R\$\)/ }), {
      target: { value: '29.90' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /Categoria/ }), {
      target: { value: categoryId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar prato' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/admin/menus/${menuId}/products`),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"promotionalPrice":null'),
        }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/admin/menus/${menuId}/products`),
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});
