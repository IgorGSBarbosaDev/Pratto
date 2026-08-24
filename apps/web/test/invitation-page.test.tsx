import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  accept: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('../features/team/api-client', () => ({
  teamApi: {
    previewInvitation: mocks.preview,
    acceptInvitation: mocks.accept,
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));

import AcceptInvitationPage from '../app/invitations/accept/page';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AcceptInvitationPage />
    </QueryClientProvider>,
  );
}

describe('AcceptInvitationPage', () => {
  afterEach(() => {
    cleanup();
    mocks.preview.mockReset();
    mocks.accept.mockReset();
    mocks.replace.mockReset();
    window.history.replaceState(null, '', '/invitations/accept');
  });

  it('requires a token and shows a stable invalid-link message', () => {
    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('O link do convite está incompleto.');
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it('collects account details for a new invitee and redirects after acceptance', async () => {
    window.history.replaceState(null, '', '/invitations/accept#token=invite-token');
    mocks.preview.mockResolvedValue({
      email: 'novo@example.com',
      role: 'MEMBER',
      establishmentName: 'Pratto Burger',
      accountExists: false,
    });
    mocks.accept.mockResolvedValue(undefined);

    renderPage();

    expect(await screen.findByText(/Pratto Burger/)).toBeInTheDocument();
    fireEvent.change(document.querySelector('input:not([type="password"])')!, {
      target: { value: 'Novo Membro' },
    });
    fireEvent.change(document.querySelector('input[type="password"]')!, {
      target: { value: 'senha-de-convite-segura' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    await waitFor(() =>
      expect(mocks.accept.mock.calls[0]?.[0]).toEqual({
        token: 'invite-token',
        name: 'Novo Membro',
        password: 'senha-de-convite-segura',
      }),
    );
    expect(mocks.replace).toHaveBeenCalledWith('/login');
  });

  it('does not ask for a password when the invited e-mail already has an account', async () => {
    window.history.replaceState(null, '', '/invitations/accept#token=existing-token');
    mocks.preview.mockResolvedValue({
      email: 'existente@example.com',
      role: 'ADMIN',
      establishmentName: 'Pratto Burger',
      accountExists: true,
    });
    mocks.accept.mockResolvedValue(undefined);

    renderPage();

    expect(await screen.findByText(/Sua conta já existe/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Seu nome' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar convite' }));
    await waitFor(() =>
      expect(mocks.accept.mock.calls[0]?.[0]).toEqual({ token: 'existing-token' }),
    );
  });
});
