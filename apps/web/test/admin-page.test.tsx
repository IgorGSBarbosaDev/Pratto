import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  context: {
    user: { id: 'user-id', name: 'Igor', email: 'igor@example.com' },
    organizations: [],
    establishments: [{ id: 'establishment-id', name: 'Pratto Burger' }],
    activeOrganization: { id: 'organization-id', name: 'Pratto', role: 'OWNER' },
    activeEstablishment: { id: 'establishment-id', name: 'Pratto Burger' },
    organizationSelectionRequired: false,
  },
  logout: vi.fn(),
  replace: vi.fn(),
  listMenus: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('../features/auth/auth-boundary', () => ({
  AuthBoundary: ({ children }: { children: (context: typeof mocks.context) => unknown }) =>
    children(mocks.context),
}));
vi.mock('../features/auth/api-client', () => ({ authApi: { logout: mocks.logout } }));
vi.mock('../features/catalog/api-client', () => ({
  catalogApi: { listMenusForEstablishment: mocks.listMenus },
}));

vi.mock('../features/analytics/analytics-dashboard', () => ({
  AnalyticsDashboard: () => <div>Analytics view</div>,
}));
vi.mock('../features/catalog/category-management', () => ({
  CategoryManagement: () => <div>Category view</div>,
}));
vi.mock('../features/catalog/product-management', () => ({
  ProductManagement: () => <div>Product view</div>,
}));
vi.mock('../features/catalog/publication-management', () => ({
  PublicationManagement: () => <div>Publication view</div>,
}));
vi.mock('../features/establishments/settings-form', () => ({
  EstablishmentSettingsForm: () => <div>Settings view</div>,
}));
vi.mock('../features/team/team-management', () => ({
  TeamManagement: () => <div>Team view</div>,
}));

import { AdminPage } from '../features/admin/admin-page';

describe('AdminPage', () => {
  afterEach(() => {
    cleanup();
    mocks.logout.mockReset();
    mocks.replace.mockReset();
    mocks.listMenus.mockReset();
    mocks.context.establishments = [{ id: 'establishment-id', name: 'Pratto Burger' }];
    mocks.context.activeOrganization = { id: 'organization-id', name: 'Pratto', role: 'OWNER' };
  });

  function renderAdmin() {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <AdminPage publicMenuBaseUrl="http://localhost:3100" />
      </QueryClientProvider>,
    );
  }

  it('derives the owner navigation, keeps explicit menu context and logs out', async () => {
    mocks.listMenus.mockResolvedValue({
      establishmentId: 'establishment-id',
      menus: [{ id: 'menu-id', name: 'Menu principal', status: 'DRAFT' }],
    });
    mocks.logout.mockResolvedValue(undefined);

    renderAdmin();

    expect(screen.getByText('Pratto Burger')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Visão geral' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pratos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicação' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Informações' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Equipe' })).toBeInTheDocument();
    expect(screen.getByText('Analytics view')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publicação' }));
    expect(await screen.findByText('Publication view')).toBeInTheDocument();
    fireEvent.change(await screen.findByRole('combobox', { name: 'Menu editável' }), {
      target: { value: 'menu-id' },
    });
    expect(screen.getByRole('option', { name: 'Menu principal (rascunho)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });

  it('does not expose publication/settings navigation to a member', () => {
    mocks.context.activeOrganization = {
      id: 'organization-id',
      name: 'Pratto',
      role: 'MEMBER',
    };
    mocks.listMenus.mockResolvedValue({ establishmentId: 'establishment-id', menus: [] });

    renderAdmin();

    expect(screen.getByRole('button', { name: 'Pratos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicação' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Informações' })).not.toBeInTheDocument();
  });

  it('renders the empty establishment state without attempting catalog loading', () => {
    mocks.context.establishments = [];

    renderAdmin();

    expect(
      screen.getByRole('heading', { name: 'Nenhum estabelecimento ativo' }),
    ).toBeInTheDocument();
    expect(mocks.listMenus).not.toHaveBeenCalled();
  });
});
