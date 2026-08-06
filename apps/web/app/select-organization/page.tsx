'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { authApi } from '../../features/auth/api-client';
import { AuthBoundary, authQueryKey } from '../../features/auth/auth-boundary';
import { authErrorMessage } from '../../features/auth/error-message';

export default function SelectOrganizationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const select = useMutation({
    mutationFn: authApi.selectOrganization,
    onSuccess: (context) => {
      queryClient.setQueryData(authQueryKey, context);
      router.replace('/admin');
    },
  });

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-white">
      <section className="mx-auto max-w-xl">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-300">Pratto</p>
        <h1 className="mt-3 text-3xl font-bold">Escolha uma organização</h1>
        <p className="mt-2 text-slate-400">
          Seu acesso será revalidado em cada requisição administrativa.
        </p>
        <div className="mt-8">
          <AuthBoundary>
            {(context) => (
              <div className="grid gap-3">
                {context.organizations.map((organization) => (
                  <button
                    key={organization.membershipId}
                    type="button"
                    disabled={select.isPending}
                    onClick={() => select.mutate(organization.membershipId)}
                    className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left transition hover:border-amber-300"
                  >
                    <span className="block text-lg font-semibold">{organization.name}</span>
                    <span className="mt-1 block text-sm text-slate-400">
                      Perfil: {organization.role}
                    </span>
                  </button>
                ))}
                <div aria-live="polite" className="text-sm text-rose-300">
                  {select.error ? authErrorMessage(select.error) : null}
                </div>
              </div>
            )}
          </AuthBoundary>
        </div>
      </section>
    </main>
  );
}
