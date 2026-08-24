import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  me: vi.fn(),
  replace: vi.fn(),
  pathname: '/admin',
}));

vi.mock('../features/auth/api-client', () => {
  class MockApiClientError extends Error {
    constructor(
      public readonly statusCode: number,
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    ApiClientError: MockApiClientError,
    authApi: { me: mocks.me },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => mocks.pathname,
}));

import { ApiClientError } from '../features/auth/api-client';
import { AuthBoundary } from '../features/auth/auth-boundary';

const context = {
  user: { id: 'user-id', name: 'Igor', email: 'igor@example.com' },
  organizations: [],
  establishments: [],
  activeOrganization: null,
  activeEstablishment: null,
  organizationSelectionRequired: false,
};

function renderBoundary() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthBoundary>{(value) => <p>Autenticado: {value.user.name}</p>}</AuthBoundary>
    </QueryClientProvider>,
  );
}

describe('AuthBoundary', () => {
  afterEach(() => {
    mocks.me.mockReset();
    mocks.replace.mockReset();
  });

  it('shows a loading state before session validation completes', () => {
    mocks.me.mockReturnValue(new Promise(() => undefined));

    renderBoundary();

    expect(screen.getByRole('status')).toHaveTextContent('Confirmando sua sessão');
  });

  it('redirects unauthenticated users to login while keeping the requested path', async () => {
    mocks.me.mockRejectedValue(new ApiClientError(401, 'UNAUTHORIZED', 'Sessão inválida'));

    renderBoundary();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível validar sua sessão.',
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login?next=%2Fadmin'));
  });

  it('redirects users who must select an organization', async () => {
    mocks.me.mockResolvedValue({ ...context, organizationSelectionRequired: true });

    renderBoundary();

    expect(await screen.findByText('Autenticado: Igor')).toBeInTheDocument();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/select-organization'));
  });

  it('renders the protected content after a valid session response', async () => {
    mocks.me.mockResolvedValue(context);

    renderBoundary();

    expect(await screen.findByText('Autenticado: Igor')).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
