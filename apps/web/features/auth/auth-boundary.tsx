'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { ApiClientError, authApi } from './api-client';

export const authQueryKey = ['auth', 'me'] as const;

export function AuthBoundary({
  children,
}: {
  children: (context: Awaited<ReturnType<typeof authApi.me>>) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const query = useQuery({ queryKey: authQueryKey, queryFn: authApi.me });

  useEffect(() => {
    if (query.error instanceof ApiClientError && query.error.statusCode === 401) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, query.error, router]);

  useEffect(() => {
    if (query.data?.organizationSelectionRequired && pathname !== '/select-organization') {
      router.replace('/select-organization');
    }
  }, [pathname, query.data, router]);

  if (query.isPending) {
    return (
      <p role="status" className="text-sm text-ink-faint">
        Confirmando sua sessão…
      </p>
    );
  }
  if (query.error || !query.data) {
    return (
      <p role="alert" className="text-sm text-accent-deep">
        Não foi possível validar sua sessão.
      </p>
    );
  }
  return children(query.data);
}
