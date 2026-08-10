'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@pratto/validation';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { authApi } from '../../../features/auth/api-client';
import { authErrorMessage } from '../../../features/auth/error-message';
import { AuthCard, Field, submitClass } from '../../../features/auth/form-controls';

const formSchema = z.object({ password: passwordSchema });
type FormInput = z.infer<typeof formSchema>;

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string>();
  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '' },
  });
  const reset = useMutation({
    mutationFn: ({ password }: FormInput) => authApi.resetPassword(token ?? '', password),
  });

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? undefined;
    setToken(value);
    window.history.replaceState(null, '', window.location.pathname);
    document.getElementById('password')?.focus();
  }, []);

  return (
    <AuthCard eyebrow="Segurança" title="Escolha uma nova senha">
      {reset.isSuccess ? (
        <div aria-live="polite" className="grid gap-5 text-ink-soft">
          <p>Senha alterada. Todas as sessões anteriores foram encerradas.</p>
          <Link className="font-semibold text-accent-deep" href="/login">
            Entrar com a nova senha
          </Link>
        </div>
      ) : (
        <form
          className="grid gap-5"
          onSubmit={form.handleSubmit((value) => reset.mutate(value))}
          noValidate
        >
          {!token ? (
            <p role="alert" className="text-sm text-accent-deep">
              O link não contém um token válido.
            </p>
          ) : null}
          <Field
            id="password"
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
          <p className="text-xs leading-5 text-ink-faint">
            Use entre 15 e 128 caracteres. Espaços e caracteres Unicode são permitidos.
          </p>
          <div aria-live="polite" className="min-h-5 text-sm text-accent-deep">
            {reset.error ? authErrorMessage(reset.error) : null}
          </div>
          <button className={submitClass} disabled={!token || reset.isPending} type="submit">
            {reset.isPending ? 'Alterando…' : 'Alterar senha'}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
