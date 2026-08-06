'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@pratto/validation';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

import { authApi } from '../../../features/auth/api-client';
import { authErrorMessage } from '../../../features/auth/error-message';
import { AuthCard, Field, submitClass } from '../../../features/auth/form-controls';

export default function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });
  const requestReset = useMutation({
    mutationFn: ({ email }: ForgotPasswordInput) => authApi.forgotPassword(email),
  });

  return (
    <AuthCard eyebrow="Recuperação" title="Redefina sua senha">
      {requestReset.data ? (
        <div aria-live="polite" className="grid gap-5 text-slate-300">
          <p>{requestReset.data.message}</p>
          <Link className="font-semibold text-amber-300" href="/login">
            Voltar ao login
          </Link>
        </div>
      ) : (
        <form
          className="grid gap-5"
          onSubmit={form.handleSubmit((value) => requestReset.mutate(value))}
          noValidate
        >
          <p className="text-sm leading-6 text-slate-400">
            Informe seu e-mail. A resposta será a mesma exista ou não uma conta.
          </p>
          <Field
            id="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <div aria-live="polite" className="min-h-5 text-sm text-rose-300">
            {requestReset.error ? authErrorMessage(requestReset.error) : null}
          </div>
          <button className={submitClass} disabled={requestReset.isPending} type="submit">
            {requestReset.isPending ? 'Enviando…' : 'Enviar instruções'}
          </button>
          <Link className="text-center text-sm text-amber-300" href="/login">
            Voltar ao login
          </Link>
        </form>
      )}
    </AuthCard>
  );
}
