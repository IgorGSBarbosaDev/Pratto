'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { authErrorMessage } from '../../../features/auth/error-message';
import { Button, Field, TextInput } from '../../../features/design-system/primitives';
import { teamApi } from '../../../features/team/api-client';

export default function AcceptInvitationPage() {
  const router = useRouter();
  const [token, setToken] = useState<string>();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    if (value) {
      setToken(value);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const preview = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => teamApi.previewInvitation(token!),
    enabled: Boolean(token),
    retry: false,
  });
  const accept = useMutation({
    mutationFn: () =>
      teamApi.acceptInvitation({
        token: token!,
        ...(preview.data?.accountExists ? {} : { name: name.trim(), password }),
      }),
    onSuccess: () => router.replace('/login'),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    accept.mutate();
  }

  const invitation = preview.data;
  const invalid = !token || Boolean(preview.error);
  return (
    <main className="flex min-h-screen items-center justify-center bg-sand px-5 py-12 text-ink">
      <section className="w-full max-w-lg rounded-2xl border border-line bg-cream p-7 shadow-[0_28px_70px_-38px_rgba(24,23,22,0.35)] sm:p-9">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink font-serif text-2xl text-cream">
            P
          </span>
          <span className="text-sm font-semibold tracking-[0.1em]">PRATTO</span>
        </div>
        <p className="mt-8 text-[13px] font-medium text-ink-faint">Convite de equipe</p>
        <h1 className="mt-2 font-serif text-[36px] leading-tight">Entre para a equipe</h1>
        {preview.isPending ? (
          <p className="mt-4 text-sm text-ink-faint">Validando o convite…</p>
        ) : null}
        {invalid ? (
          <p className="mt-4 pratto-error" role="alert">
            {token ? authErrorMessage(preview.error) : 'O link do convite está incompleto.'}
          </p>
        ) : invitation ? (
          <form className="mt-6 space-y-5" onSubmit={submit}>
            <p className="rounded-xl bg-sand px-4 py-3 text-sm leading-6 text-ink-soft">
              Você foi convidado para colaborar em <strong>{invitation.establishmentName}</strong>{' '}
              como <strong>{roleLabel(invitation.role)}</strong>.
              <br />
              Convite enviado para {invitation.email}.
            </p>
            {!invitation.accountExists ? (
              <>
                <Field label="Seu nome" required>
                  <TextInput
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Crie uma senha" required hint="Use entre 15 e 128 caracteres.">
                  <TextInput
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={15}
                    required
                  />
                </Field>
              </>
            ) : (
              <p className="text-sm leading-6 text-ink-soft">
                Sua conta já existe. Depois de aceitar, entre normalmente com sua senha.
              </p>
            )}
            {accept.error ? (
              <p className="pratto-error" role="alert">
                {authErrorMessage(accept.error)}
              </p>
            ) : null}
            <Button type="submit" disabled={accept.isPending}>
              {accept.isPending ? 'Aceitando…' : 'Aceitar convite'}
            </Button>
          </form>
        ) : null}
      </section>
    </main>
  );
}

function roleLabel(role: 'OWNER' | 'ADMIN' | 'MEMBER'): string {
  return role === 'OWNER' ? 'proprietário' : role === 'ADMIN' ? 'administrador' : 'membro';
}
