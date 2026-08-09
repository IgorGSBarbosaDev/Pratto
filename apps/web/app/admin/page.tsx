'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { AnalyticsDashboard } from '../../features/analytics/analytics-dashboard';
import { authApi } from '../../features/auth/api-client';
import { AuthBoundary } from '../../features/auth/auth-boundary';
import { authErrorMessage } from '../../features/auth/error-message';
import { CategoryManagement } from '../../features/catalog/category-management';
import { ProductManagement } from '../../features/catalog/product-management';
import { PublicationManagement } from '../../features/catalog/publication-management';
import { EstablishmentSettingsForm } from '../../features/establishments/settings-form';

export default function AdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.clear();
      router.replace('/login');
    },
  });

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <AuthBoundary>
          {(context) => (
            <>
              <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-300">
                    Pratto Admin
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">
                    {context.activeOrganization?.name ?? 'Administração'}
                  </h1>
                </div>
                <button
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:border-slate-500"
                  type="button"
                  disabled={logout.isPending}
                  onClick={() => logout.mutate()}
                >
                  {logout.isPending ? 'Saindo…' : 'Sair'}
                </button>
              </header>
              <section className="py-10">
                <h2 className="text-xl font-semibold">Configuração do estabelecimento</h2>
                <p className="mt-2 max-w-2xl text-slate-400">
                  Olá, {context.user.name}. Gerencie os dados públicos, horários e identidade visual
                  do estabelecimento selecionado.
                </p>
                {context.establishments.length === 0 ? (
                  <div className="mt-7 rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                    Nenhum estabelecimento ativo está disponível para esta organização.
                  </div>
                ) : (
                  <div className="mt-7">
                    <p className="mb-4 text-sm text-slate-500">
                      Editando:{' '}
                      <span className="text-slate-300">{context.establishments[0]?.name}</span>
                    </p>
                    <AnalyticsDashboard establishmentId={context.establishments[0]!.id} />
                    <EstablishmentSettingsForm establishmentId={context.establishments[0]!.id} />
                    <section className="mt-10">
                      <h2 className="text-xl font-semibold">Categorias do cardápio</h2>
                      <p className="mt-2 max-w-2xl text-slate-400">
                        Organize as seções do menu editável. As alterações não mudam publicações
                        anteriores.
                      </p>
                      <div className="mt-7">
                        <CategoryManagement establishmentId={context.establishments[0]!.id} />
                      </div>
                    </section>
                    <section className="mt-10">
                      <h2 className="text-xl font-semibold">Produtos do cardápio</h2>
                      <p className="mt-2 max-w-2xl text-slate-400">
                        Cadastre e organize os produtos do catálogo editável, sem alterar
                        publicações anteriores.
                      </p>
                      <div className="mt-7">
                        <ProductManagement establishmentId={context.establishments[0]!.id} />
                      </div>
                    </section>
                    <section className="mt-10">
                      <h2 className="text-xl font-semibold">Publicação do cardápio</h2>
                      <p className="mt-2 max-w-2xl text-slate-400">
                        Publique uma versão imutável do catálogo editável para preparar o consumo
                        pelo futuro cardápio público.
                      </p>
                      <div className="mt-7">
                        <PublicationManagement establishmentId={context.establishments[0]!.id} />
                      </div>
                    </section>
                  </div>
                )}
                <div aria-live="polite" className="mt-4 text-sm text-rose-300">
                  {logout.error ? authErrorMessage(logout.error) : null}
                </div>
              </section>
            </>
          )}
        </AuthBoundary>
      </div>
    </main>
  );
}
