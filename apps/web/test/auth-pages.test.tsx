import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  replace: vi.fn(),
  next: '/reports',
}));

vi.mock('../features/auth/api-client', () => ({
  authApi: {
    login: mocks.login,
    forgotPassword: mocks.forgotPassword,
    resetPassword: mocks.resetPassword,
  },
}));
vi.mock('../features/auth/auth-boundary', () => ({ authQueryKey: ['auth', 'me'] }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => ({ get: (key: string) => (key === 'next' ? mocks.next : null) }),
}));

import ForgotPasswordPage from '../app/(auth)/forgot-password/page';
import LoginPage from '../app/(auth)/login/page';
import ResetPasswordPage from '../app/(auth)/reset-password/page';

const authContext = {
  user: { id: 'user-id', name: 'Igor', email: 'igor@example.com' },
  organizations: [],
  establishments: [],
  activeOrganization: null,
  activeEstablishment: null,
  organizationSelectionRequired: false,
};

function renderWithClient(element: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

describe('authentication pages', () => {
  afterEach(() => {
    cleanup();
    mocks.login.mockReset();
    mocks.forgotPassword.mockReset();
    mocks.resetPassword.mockReset();
    mocks.replace.mockReset();
    mocks.next = '/reports';
    window.history.replaceState(null, '', '/reset-password');
  });

  it('validates login input and redirects to a safe internal destination', async () => {
    mocks.login.mockResolvedValue(authContext);
    mocks.next = '/reports';

    renderWithClient(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Invalid email')).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();

    fireEvent.change(document.querySelector('input#email')!, {
      target: { value: 'igor@example.com' },
    });
    fireEvent.change(document.querySelector('input#password')!, {
      target: { value: 'senha-segura-com-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() =>
      expect(mocks.login.mock.calls[0]?.[0]).toEqual({
        email: 'igor@example.com',
        password: 'senha-segura-com-15',
      }),
    );
    expect(mocks.replace).toHaveBeenCalledWith('/reports');
  });

  it('falls back to the admin area instead of accepting an external login destination', async () => {
    mocks.login.mockResolvedValue(authContext);
    mocks.next = '//evil.example.com';

    renderWithClient(<LoginPage />);
    fireEvent.change(document.querySelector('input#email')!, {
      target: { value: 'igor@example.com' },
    });
    fireEvent.change(document.querySelector('input#password')!, {
      target: { value: 'senha-segura-com-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/admin'));
  });

  it('submits password recovery and displays the neutral response', async () => {
    mocks.forgotPassword.mockResolvedValue({
      message: 'Se o e-mail existir, enviaremos instruções.',
    });

    renderWithClient(<ForgotPasswordPage />);
    fireEvent.change(document.querySelector('input#email')!, {
      target: { value: 'igor@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar instruções' }));
    await waitFor(() => expect(mocks.forgotPassword).toHaveBeenCalledWith('igor@example.com'));
    expect(
      await screen.findByText('Se o e-mail existir, enviaremos instruções.'),
    ).toBeInTheDocument();
  });

  it('requires a reset token and sends the new password only when the token is present', async () => {
    window.history.replaceState(null, '', '/reset-password#token=reset-token');
    mocks.resetPassword.mockResolvedValue(undefined);

    renderWithClient(<ResetPasswordPage />);
    const submit = await screen.findByRole('button', { name: 'Alterar senha' });
    expect(submit).not.toBeDisabled();
    fireEvent.change(document.querySelector('input#password')!, {
      target: { value: 'senha-nova-segura-15' },
    });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(mocks.resetPassword).toHaveBeenCalledWith('reset-token', 'senha-nova-segura-15'),
    );
    expect(await screen.findByText(/Senha alterada/)).toBeInTheDocument();
  });
});
