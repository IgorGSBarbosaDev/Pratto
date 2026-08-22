import type { TeamInvitation, TeamMember, TeamResponse } from '@pratto/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamManagement } from '../features/team/team-management';

const establishmentId = '11111111-1111-4111-8111-111111111111';
const ownerUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const adminUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const memberUserId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const owner = member({
  id: '11111111-1111-4111-8111-111111111111',
  userId: ownerUserId,
  name: 'Olívia Owner',
  email: 'owner@example.com',
  role: 'OWNER',
});
const admin = member({
  id: '22222222-2222-4222-8222-222222222222',
  userId: adminUserId,
  name: 'Ana Admin',
  email: 'admin@example.com',
  role: 'ADMIN',
});
const regularMember = member({
  id: '33333333-3333-4333-8333-333333333333',
  userId: memberUserId,
  name: 'Mário Member',
  email: 'member@example.com',
  role: 'MEMBER',
});
const pendingInvitation = invitation({
  id: '44444444-4444-4444-8444-444444444444',
  email: 'pending@example.com',
  role: 'MEMBER',
  status: 'PENDING',
});

function member(overrides: Partial<TeamMember>): TeamMember {
  return {
    id: '00000000-0000-4000-8000-000000000000',
    userId: '00000000-0000-4000-8000-000000000000',
    name: 'Pessoa',
    email: 'person@example.com',
    role: 'MEMBER',
    status: 'ACTIVE',
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
    ...overrides,
  };
}

function invitation(overrides: Partial<TeamInvitation>): TeamInvitation {
  return {
    id: '00000000-0000-4000-8000-000000000000',
    email: 'invite@example.com',
    role: 'MEMBER',
    status: 'PENDING',
    establishmentId,
    expiresAt: '2026-08-29T00:00:00.000Z',
    acceptedAt: null,
    canceledAt: null,
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
    ...overrides,
  };
}

function teamResponse(overrides: Partial<TeamResponse> = {}): TeamResponse {
  return {
    establishmentId,
    members: [owner, admin, regularMember],
    invitations: [pendingInvitation],
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function noContentResponse() {
  return Promise.resolve(new Response(null, { status: 204 }));
}

function renderTeam(actorRole: 'OWNER' | 'ADMIN' | 'MEMBER', actorId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TeamManagement establishmentId={establishmentId} actorId={actorId} actorRole={actorRole} />
    </QueryClientProvider>,
  );
}

function teamFetchMock(response: TeamResponse = teamResponse()) {
  return vi.fn((url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/team')) return jsonResponse(response);
    throw new Error(`Unexpected team request: ${init?.method ?? 'GET'} ${path}`);
  });
}

function mutationCalls(fetchMock: ReturnType<typeof teamFetchMock>, method: string, path: string) {
  return fetchMock.mock.calls.filter(
    ([url, init]) => new URL(url).pathname.endsWith(path) && (init?.method ?? 'GET') === method,
  );
}

function inviteFormControls() {
  const form = screen.getByRole('button', { name: 'Enviar convite' }).closest('form');
  if (!form) throw new Error('Invite form was not rendered');
  return {
    email: within(form).getByRole('textbox'),
    role: within(form).getByRole('combobox'),
    submit: within(form).getByRole('button', { name: 'Enviar convite' }),
  };
}

function openInviteDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Convidar membro' }));
}

beforeEach(() => {
  document.cookie = 'pratto_csrf=test-csrf';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TeamManagement', () => {
  it('renders active members, roles and pending invitations', async () => {
    const fetchMock = teamFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    renderTeam('OWNER', ownerUserId);

    expect(await screen.findByText('Olívia Owner')).toBeInTheDocument();
    expect(screen.getByText('Ana Admin')).toBeInTheDocument();
    expect(screen.getByText('Mário Member')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Papel de admin@example.com' })).toHaveValue(
      'ADMIN',
    );
    expect(screen.getByRole('combobox', { name: 'Papel de member@example.com' })).toHaveValue(
      'MEMBER',
    );
    expect(screen.getByText('pending@example.com')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText(/Expira em/)).toBeInTheDocument();
  });

  it('hides management controls for MEMBER', async () => {
    const fetchMock = teamFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    renderTeam('MEMBER', memberUserId);

    await screen.findByText('Mário Member');
    expect(screen.queryByRole('button', { name: 'Enviar convite' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Convidar membro' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remover / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reenviar convite/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancelar convite/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Papel de/ })).not.toBeInTheDocument();
  });

  it('limits ADMIN controls to assignable roles and manageable members', async () => {
    const fetchMock = teamFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    renderTeam('ADMIN', adminUserId);

    await screen.findByText('Olívia Owner');
    openInviteDialog();
    const { email, role: inviteRole, submit } = inviteFormControls();
    expect(
      within(inviteRole).queryByRole('option', { name: 'Proprietário' }),
    ).not.toBeInTheDocument();
    expect(within(inviteRole).getByRole('option', { name: 'Administrador' })).toBeInTheDocument();
    expect(within(inviteRole).getByRole('option', { name: 'Membro' })).toBeInTheDocument();
    fireEvent.change(email, { target: { value: 'new@example.com' } });
    expect(submit).toBeEnabled();

    expect(
      screen.queryByRole('combobox', { name: 'Papel de owner@example.com' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Papel de admin@example.com' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Papel de member@example.com' })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Remover owner@example.com' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover member@example.com' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reenviar convite para pending@example.com' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cancelar convite para pending@example.com' }),
    ).toBeInTheDocument();
  });

  it('gives OWNER all assignable invite roles and member controls', async () => {
    const fetchMock = teamFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    renderTeam('OWNER', ownerUserId);

    await screen.findByText('Olívia Owner');
    openInviteDialog();
    const { email, role: inviteRole, submit } = inviteFormControls();
    expect(within(inviteRole).getByRole('option', { name: 'Proprietário' })).toBeInTheDocument();
    expect(within(inviteRole).getByRole('option', { name: 'Administrador' })).toBeInTheDocument();
    expect(within(inviteRole).getByRole('option', { name: 'Membro' })).toBeInTheDocument();
    fireEvent.change(email, { target: { value: 'new@example.com' } });
    expect(submit).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Remover owner@example.com' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover admin@example.com' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover member@example.com' })).toBeInTheDocument();
  });

  it('uses native e-mail validation and disables an empty invitation', async () => {
    const fetchMock = teamFetchMock(teamResponse({ members: [], invitations: [] }));
    vi.stubGlobal('fetch', fetchMock);

    renderTeam('OWNER', ownerUserId);

    await screen.findByText('Nenhum membro ativo');
    openInviteDialog();
    const { email, submit } = inviteFormControls();

    fireEvent.change(email, { target: { value: 'not-an-email' } });
    expect(email).toBeInvalid();
    fireEvent.click(submit);
    expect(await screen.findByText('Informe um endereço de e-mail válido.')).toBeInTheDocument();
    expect(mutationCalls(fetchMock, 'POST', '/invitations')).toHaveLength(0);
  });

  it('shows invitation success and server feedback', async () => {
    let currentTeam = teamResponse({ members: [], invitations: [] });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/team')) return jsonResponse(currentTeam);
      if (path.endsWith('/invitations') && init?.method === 'POST') {
        currentTeam = teamResponse({
          members: [],
          invitations: [invitation({ email: 'new@example.com', role: 'ADMIN' })],
        });
        return jsonResponse(currentTeam.invitations[0], 201);
      }
      throw new Error(`Unexpected invite request: ${init?.method ?? 'GET'} ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTeam('OWNER', ownerUserId);
    await screen.findByText('Nenhum membro ativo');
    openInviteDialog();
    const { email, role } = inviteFormControls();
    fireEvent.change(email, { target: { value: 'new@example.com' } });
    fireEvent.change(role, { target: { value: 'ADMIN' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' }));

    expect(await screen.findByText('Convite enviado para new@example.com.')).toBeInTheDocument();
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
    await waitFor(() => expect(mutationCalls(fetchMock, 'POST', '/invitations')).toHaveLength(1));
    expect(mutationCalls(fetchMock, 'POST', '/invitations')[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ email: 'new@example.com', role: 'ADMIN' }),
      }),
    );
  });

  it('shows the API feedback for a duplicate pending invitation', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/team'))
        return jsonResponse(teamResponse({ members: [], invitations: [] }));
      if (path.endsWith('/invitations') && init?.method === 'POST') {
        return jsonResponse(
          { code: 'INVITATION_ALREADY_PENDING', message: 'Já existe um convite pendente.' },
          409,
        );
      }
      throw new Error(`Unexpected invite request: ${init?.method ?? 'GET'} ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTeam('OWNER', ownerUserId);
    await screen.findByText('Nenhum membro ativo');
    openInviteDialog();
    const { email } = inviteFormControls();
    fireEvent.change(email, {
      target: { value: 'pending@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Já existe um convite pendente para este e-mail.',
    );
  });

  it('supports role changes, resending, canceling and removing', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/team')) return jsonResponse(teamResponse());
      if (path.endsWith('/resend') && init?.method === 'POST') {
        return jsonResponse(pendingInvitation);
      }
      if (path.includes('/invitations/') && init?.method === 'DELETE') return noContentResponse();
      if (path.includes('/members/') && init?.method === 'PATCH') return jsonResponse(admin);
      if (path.includes('/members/') && init?.method === 'DELETE') return noContentResponse();
      throw new Error(`Unexpected action request: ${init?.method ?? 'GET'} ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTeam('OWNER', ownerUserId);
    await screen.findByText('Olívia Owner');

    fireEvent.change(screen.getByRole('combobox', { name: 'Papel de member@example.com' }), {
      target: { value: 'ADMIN' },
    });
    await waitFor(() =>
      expect(
        mutationCalls(fetchMock, 'PATCH', '/members/33333333-3333-4333-8333-333333333333'),
      ).toHaveLength(1),
    );
    expect(
      mutationCalls(fetchMock, 'PATCH', '/members/33333333-3333-4333-8333-333333333333')[0]?.[1],
    ).toEqual(expect.objectContaining({ body: JSON.stringify({ role: 'ADMIN' }) }));

    fireEvent.click(
      screen.getByRole('button', { name: 'Reenviar convite para pending@example.com' }),
    );
    await waitFor(() => expect(mutationCalls(fetchMock, 'POST', '/resend')).toHaveLength(1));

    fireEvent.click(
      screen.getByRole('button', { name: 'Cancelar convite para pending@example.com' }),
    );
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar convite$/ }));
    await waitFor(() =>
      expect(
        mutationCalls(fetchMock, 'DELETE', '/invitations/44444444-4444-4444-8444-444444444444'),
      ).toHaveLength(1),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remover member@example.com' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Remover acesso$/ }));
    await waitFor(() =>
      expect(
        mutationCalls(fetchMock, 'DELETE', '/members/33333333-3333-4333-8333-333333333333'),
      ).toHaveLength(1),
    );
  });
});
