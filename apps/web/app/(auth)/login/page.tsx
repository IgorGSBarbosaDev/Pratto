'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@pratto/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';

import { authApi } from '../../../features/auth/api-client';
import { authQueryKey } from '../../../features/auth/auth-boundary';
import { authErrorMessage } from '../../../features/auth/error-message';
import { AuthCard, Field, submitClass } from '../../../features/auth/form-controls';

function safeDestination(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/admin';
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (context) => {
      queryClient.setQueryData(authQueryKey, context);
      router.replace(
        context.organizationSelectionRequired
          ? '/select-organization'
          : safeDestination(search.get('next')),
      );
    },
  });

  return (
    <AuthCard eyebrow="Área administrativa" title="Entre no Pratto">
      <form
        className="grid gap-5"
        onSubmit={form.handleSubmit((value) => login.mutate(value))}
        noValidate
      >
        <Field
          id="email"
          label="E-mail"
          type="email"
          autoComplete="username"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Field
          id="password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <div aria-live="polite" className="min-h-5 text-sm text-accent-deep">
          {login.error ? authErrorMessage(login.error) : null}
        </div>
        <button className={submitClass} disabled={login.isPending} type="submit">
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </button>
        <Link
          className="text-center text-sm font-medium text-accent-deep hover:text-accent"
          href="/forgot-password"
        >
          Esqueci minha senha
        </Link>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-sand" />}>
      <LoginForm />
    </Suspense>
  );
}
