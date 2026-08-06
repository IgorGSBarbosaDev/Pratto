'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { authApi } from '../../features/auth/api-client';
import { AuthBoundary } from '../../features/auth/auth-boundary';
import { authErrorMessage } from '../../features/auth/error-message';

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
                <h2 className="text-xl font-semibold">Olá, {context.user.name}</h2>
                <p className="mt-2 max-w-2xl text-slate-400">
                  A área administrativa está protegida e pronta para receber as próximas fatias do
                  produto. O dashboard ainda não foi iniciado.
                </p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {context.establishments.map((establishment) => (
                    <article
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                      key={establishment.id}
                    >
                      <h3 className="font-semibold">{establishment.name}</h3>
                      <p className="mt-1 text-sm text-slate-400">/{establishment.slug}</p>
                    </article>
                  ))}
                </div>
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
