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
    <main className="min-h-screen bg-sand px-5 py-12 text-ink">
      <section className="mx-auto max-w-xl rounded-2xl border border-line bg-cream p-7 shadow-[0_28px_70px_-38px_rgba(24,23,22,0.35)] sm:p-9">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink font-serif text-2xl text-cream">
            P
          </span>
          <span className="text-sm font-semibold tracking-[0.1em]">PRATTO</span>
        </div>
        <h1 className="mt-8 font-serif text-[36px] leading-tight">Escolha uma organização</h1>
        <p className="mt-2 text-ink-soft">
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
                    className="rounded-2xl border border-line bg-sand/45 p-5 text-left transition hover:border-ink/30 hover:bg-sand"
                  >
                    <span className="block text-lg font-semibold">{organization.name}</span>
                    <span className="mt-1 block text-sm text-ink-faint">
                      Perfil: {organization.role}
                    </span>
                  </button>
                ))}
                <div aria-live="polite" className="text-sm text-accent-deep">
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
