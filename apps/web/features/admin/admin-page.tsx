'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Clock3,
  Eye,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Send,
  Store,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AnalyticsDashboard } from '../analytics/analytics-dashboard';
import { authApi } from '../auth/api-client';
import { AuthBoundary } from '../auth/auth-boundary';
import { authErrorMessage } from '../auth/error-message';
import { catalogApi } from '../catalog/api-client';
import { CategoryManagement } from '../catalog/category-management';
import { ProductManagement } from '../catalog/product-management';
import { PublicationManagement } from '../catalog/publication-management';
import { EstablishmentSettingsForm } from '../establishments/settings-form';
import { TeamManagement } from '../team/team-management';

type AdminView =
  | 'overview'
  | 'dishes'
  | 'categories'
  | 'preview'
  | 'publication'
  | 'settings-info'
  | 'settings-hours'
  | 'settings-appearance'
  | 'settings-team';

type NavItem = { id: AdminView; label: string; icon: LucideIcon };
type NavGroup = { title?: string; items: NavItem[] };

const groups: NavGroup[] = [
  { items: [{ id: 'overview', label: 'Visão geral', icon: BarChart3 }] },
  {
    title: 'Cardápio',
    items: [
      { id: 'dishes', label: 'Pratos', icon: UtensilsCrossed },
      { id: 'categories', label: 'Categorias', icon: LayoutGrid },
      { id: 'preview', label: 'Prévia', icon: Eye },
      { id: 'publication', label: 'Publicação', icon: Send },
    ],
  },
  {
    title: 'Restaurante',
    items: [
      { id: 'settings-info', label: 'Informações', icon: Store },
      { id: 'settings-hours', label: 'Horários', icon: Clock3 },
      { id: 'settings-appearance', label: 'Aparência', icon: Palette },
      { id: 'settings-team', label: 'Equipe', icon: Users },
    ],
  },
];

export function AdminPage({ publicMenuBaseUrl }: { publicMenuBaseUrl: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [view, setView] = useState<AdminView>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setCollapsed(window.innerWidth < 1120);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.clear();
      router.replace('/login');
    },
  });

  return (
    <AuthBoundary>
      {(context) => {
        const establishment = context.establishments[0];
        return (
          <main className="flex h-screen min-h-[680px] overflow-hidden bg-sand text-ink">
            <AdminSidebar
              active={view}
              collapsed={collapsed}
              restaurantName={establishment?.name ?? context.activeOrganization?.name ?? 'PRATTO'}
              userName={context.user.name}
              onChange={setView}
              onToggle={() => setCollapsed((value) => !value)}
              onLogout={() => logout.mutate()}
              logoutPending={logout.isPending}
            />
            <div className="min-w-0 flex-1 overflow-y-auto">
              {!establishment ? (
                <div className="mx-auto flex min-h-full max-w-xl items-center px-6">
                  <div className="pratto-panel w-full p-8 text-center">
                    <Store className="mx-auto text-ink-faint" size={28} strokeWidth={1.6} />
                    <h1 className="mt-4 font-serif text-3xl">Nenhum estabelecimento ativo</h1>
                    <p className="mt-2 text-sm leading-6 text-ink-faint">
                      Esta organização não possui um estabelecimento disponível para administração.
                    </p>
                  </div>
                </div>
              ) : (
                <AdminWorkspace
                  establishmentId={establishment.id}
                  actorId={context.user.id}
                  actorRole={context.activeOrganization?.role ?? 'MEMBER'}
                  view={view}
                  selectedMenuId={menuId}
                  onMenuChange={setMenuId}
                  publicMenuBaseUrl={publicMenuBaseUrl}
                />
              )}
              {logout.error ? (
                <div
                  className="fixed bottom-5 right-5 z-50 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-[0_12px_30px_-12px_rgba(24,23,22,0.35)]"
                  role="alert"
                >
                  {authErrorMessage(logout.error)}
                </div>
              ) : null}
            </div>
          </main>
        );
      }}
    </AuthBoundary>
  );
}

function AdminWorkspace({
  establishmentId,
  actorId,
  actorRole,
  view,
  selectedMenuId,
  onMenuChange,
  publicMenuBaseUrl,
}: {
  establishmentId: string;
  actorId: string;
  actorRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  view: AdminView;
  selectedMenuId: string | null;
  onMenuChange: (menuId: string | null) => void;
  publicMenuBaseUrl: string;
}) {
  const menusQuery = useQuery({
    queryKey: ['catalog-menus', establishmentId],
    queryFn: () => catalogApi.listMenusForEstablishment(establishmentId),
  });

  useEffect(() => {
    if (!selectedMenuId || !menusQuery.data) return;
    if (!menusQuery.data.menus.some((menu) => menu.id === selectedMenuId)) onMenuChange(null);
  }, [menusQuery.data, onMenuChange, selectedMenuId]);

  return (
    <div className="mx-auto min-h-full max-w-[1240px] px-6 py-8 lg:px-10">
      {view !== 'overview' &&
      view !== 'settings-info' &&
      view !== 'settings-hours' &&
      view !== 'settings-appearance' &&
      view !== 'settings-team' ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-cream px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sand text-ink-soft">
              <MenuIcon size={17} />
            </span>
            <div>
              <p className="text-xs font-medium text-ink-faint">Contexto de edição</p>
              <p className="text-sm font-semibold text-ink">Selecione explicitamente o menu alvo</p>
            </div>
          </div>
          <label
            className="min-w-[260px] text-xs font-medium text-ink-faint"
            htmlFor="admin-menu-context"
          >
            Menu editável
            <select
              id="admin-menu-context"
              className="pratto-input mt-1"
              value={selectedMenuId ?? ''}
              disabled={menusQuery.isPending || Boolean(menusQuery.error)}
              onChange={(event) => onMenuChange(event.target.value || null)}
            >
              <option value="">Selecione um menu</option>
              {(menusQuery.data?.menus ?? []).map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name} ({menu.status === 'ACTIVE' ? 'ativo' : 'rascunho'})
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {view === 'overview' ? <AnalyticsDashboard establishmentId={establishmentId} /> : null}
      {view === 'dishes' ? (
        <ProductManagement establishmentId={establishmentId} selectedMenuId={selectedMenuId} />
      ) : null}
      {view === 'categories' ? (
        <CategoryManagement establishmentId={establishmentId} selectedMenuId={selectedMenuId} />
      ) : null}
      {view === 'preview' ? (
        <PublicationManagement
          establishmentId={establishmentId}
          publicMenuBaseUrl={publicMenuBaseUrl}
          selectedMenuId={selectedMenuId}
          previewOnly
        />
      ) : null}
      {view === 'publication' ? (
        <PublicationManagement
          establishmentId={establishmentId}
          publicMenuBaseUrl={publicMenuBaseUrl}
          selectedMenuId={selectedMenuId}
        />
      ) : null}
      {view === 'settings-info' ? (
        <EstablishmentSettingsForm establishmentId={establishmentId} section="info" />
      ) : null}
      {view === 'settings-hours' ? (
        <EstablishmentSettingsForm establishmentId={establishmentId} section="hours" />
      ) : null}
      {view === 'settings-appearance' ? (
        <EstablishmentSettingsForm establishmentId={establishmentId} section="appearance" />
      ) : null}
      {view === 'settings-team' ? (
        <TeamManagement establishmentId={establishmentId} actorId={actorId} actorRole={actorRole} />
      ) : null}
    </div>
  );
}

function AdminSidebar({
  active,
  collapsed,
  restaurantName,
  userName,
  onChange,
  onToggle,
  onLogout,
  logoutPending,
}: {
  active: AdminView;
  collapsed: boolean;
  restaurantName: string;
  userName: string;
  onChange: (view: AdminView) => void;
  onToggle: () => void;
  onLogout: () => void;
  logoutPending: boolean;
}) {
  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-line bg-cream py-6 transition-[width,padding] duration-200 ${collapsed ? 'w-[76px] px-3' : 'w-60 px-4'}`}
    >
      <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'px-2'}`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink font-serif text-2xl text-cream">
          {restaurantName.slice(0, 1).toUpperCase()}
        </div>
        {!collapsed ? (
          <div className="min-w-0 leading-tight">
            <p className="truncate font-serif text-[19px] text-ink">{restaurantName}</p>
            <p className="truncate text-xs text-ink-faint">Olá, {userName}</p>
          </div>
        ) : null}
      </div>
      <nav className="mt-7 flex flex-1 flex-col gap-5" aria-label="Administração">
        {groups.map((group, index) => (
          <div key={group.title ?? index}>
            {group.title && !collapsed ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                {group.title}
              </p>
            ) : null}
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const selected = active === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={collapsed ? item.label : undefined}
                    aria-current={selected ? 'page' : undefined}
                    onClick={() => onChange(item.id)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${collapsed ? 'justify-center' : ''} ${selected ? 'bg-ink text-white' : 'text-ink-soft hover:bg-sand'}`}
                  >
                    <Icon size={18} strokeWidth={selected ? 2.2 : 1.8} aria-hidden="true" />
                    {!collapsed ? item.label : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <button
        type="button"
        onClick={onLogout}
        disabled={logoutPending}
        title={collapsed ? 'Sair' : undefined}
        className={`mb-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-faint transition hover:bg-sand hover:text-ink disabled:opacity-45 ${collapsed ? 'justify-center' : ''}`}
      >
        <LogOut size={17} aria-hidden="true" />{' '}
        {!collapsed ? (logoutPending ? 'Saindo…' : 'Sair') : null}
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
        title={collapsed ? 'Expandir barra lateral' : undefined}
        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-faint transition hover:bg-sand ${collapsed ? 'justify-center' : ''}`}
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        {!collapsed ? 'Recolher' : null}
      </button>
    </aside>
  );
}
