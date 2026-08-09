import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CategoryManagement } from '../features/catalog/category-management';

const menuId = '33333333-3333-4333-8333-333333333333';

function renderWithQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CategoryManagement establishmentId="11111111-1111-4111-8111-111111111111" />
    </QueryClientProvider>,
  );
}

describe('CategoryManagement', () => {
  it('requires an explicit menu before showing the category editor', async () => {
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
      return Promise.resolve(
        new Response(JSON.stringify({ menuId, categories: [] }), {
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
    expect(screen.queryByText('Nenhuma categoria cadastrada.')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Menu alvo' }), {
      target: { value: menuId },
    });
    expect(await screen.findByText('Nenhuma categoria cadastrada.')).toBeInTheDocument();
    await screen
      .findByRole('button', { name: 'Adicionar categoria' })
      .then((button) => button.click());
    expect(await screen.findByText(/informe o nome/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/establishments/11111111-1111-4111-8111-111111111111/menus'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});
