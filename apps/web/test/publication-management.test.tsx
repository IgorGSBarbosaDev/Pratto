import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PublicationManagement } from '../features/catalog/publication-management';

const menuId = '33333333-3333-4333-8333-333333333333';
const publication = {
  id: '44444444-4444-4444-8444-444444444444',
  menuId,
  version: 1,
  snapshot: { schemaVersion: 3 },
  publishedAt: '2026-08-09T12:00:00.000Z',
  publishedBy: 'user-id',
};

function renderWithQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicationManagement establishmentId="11111111-1111-4111-8111-111111111111" />
    </QueryClientProvider>,
  );
}

describe('PublicationManagement', () => {
  it('requires an explicit menu and publishes with user feedback', async () => {
    document.cookie = 'pratto_csrf=test-csrf';
    let published = false;
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/establishments/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              establishmentId: '11111111-1111-4111-8111-111111111111',
              menus: [
                { id: menuId, name: 'Menu principal', status: published ? 'ACTIVE' : 'DRAFT' },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      if (options?.method === 'POST') {
        published = true;
        return Promise.resolve(
          new Response(JSON.stringify(publication), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (url.endsWith('/publication')) {
        return Promise.resolve(
          new Response(JSON.stringify({ menuId, publication: published ? publication : null }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            menuId,
            publications: published
              ? [
                  {
                    id: publication.id,
                    menuId,
                    version: 1,
                    publishedAt: publication.publishedAt,
                    publishedBy: publication.publishedBy,
                  },
                ]
              : [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient();

    expect(
      await screen.findByText('Selecione explicitamente o menu que deseja publicar.'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Menu para publicar' }), {
      target: { value: menuId },
    });
    expect(await screen.findByText('Ainda não publicado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publicar cardápio' }));

    expect(
      await screen.findByText('Cardápio publicado com sucesso na versão 1.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST');
      expect(post).toBeDefined();
      expect((post?.[1]?.headers as Headers).get('idempotency-key')).toEqual(expect.any(String));
    });
  });
});
