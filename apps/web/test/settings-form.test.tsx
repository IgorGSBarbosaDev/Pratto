import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EstablishmentSettingsForm } from '../features/establishments/settings-form';

const establishmentId = '11111111-1111-4111-8111-111111111111';

const hours = {
  monday: { open: '08:00', close: '18:00', closed: false },
  tuesday: { open: '08:00', close: '18:00', closed: false },
  wednesday: { open: '08:00', close: '18:00', closed: false },
  thursday: { open: '08:00', close: '18:00', closed: false },
  friday: { open: '08:00', close: '18:00', closed: false },
  saturday: { open: '09:00', close: '14:00', closed: false },
  sunday: { open: '09:00', close: '14:00', closed: true },
};

const settings = {
  id: establishmentId,
  publicId: 'pratto-public-id',
  name: 'Pratto Burger',
  slug: 'pratto-burger',
  description: 'Hambúrguer artesanal',
  phone: '11999999999',
  whatsapp: '11999999999',
  address: {
    street: 'Rua A',
    number: '10',
    complement: '',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01000-000',
  },
  operatingHours: hours,
  theme: { mode: 'LIGHT', primaryColor: '#f45b3d' },
  logo: null,
  coverImage: null,
};

function response(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function renderForm(section: 'info' | 'hours' | 'appearance' | 'all' = 'all') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <EstablishmentSettingsForm establishmentId={establishmentId} section={section} />
    </QueryClientProvider>,
  );
}

describe('EstablishmentSettingsForm', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.cookie = 'pratto_csrf=test-csrf';
  });

  it('loads settings, validates required identity and saves the edited information', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'PATCH') return response(settings);
      return response(settings);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderForm('info');
    await screen.findByDisplayValue('Pratto Burger');
    const name = container.querySelector('input[name="name"]') as HTMLInputElement;
    fireEvent.change(name, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar informações' }));
    expect(await screen.findByText(/at least 1 character/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining(`/admin/establishments/${establishmentId}/settings`),
      expect.objectContaining({ method: 'PATCH' }),
    );

    fireEvent.change(name, { target: { value: 'Pratto Centro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar informações' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/admin/establishments/${establishmentId}/settings`),
        expect.objectContaining({ method: 'PATCH', credentials: 'include' }),
      ),
    );
    const patchCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH');
    expect(JSON.parse(patchCall?.[1]?.body as string)).toMatchObject({ name: 'Pratto Centro' });
    expect(await screen.findByText('Configurações salvas.')).toBeInTheDocument();
  });

  it('changes hours and appearance through the section-specific forms', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'PATCH') return response(settings);
      return response(settings);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderForm('hours');
    expect(await screen.findByRole('heading', { name: 'Horários' })).toBeInTheDocument();
    const mondayToggle = screen.getByRole('switch', { name: 'Segunda-feira aberto' });
    fireEvent.click(mondayToggle);
    expect(mondayToggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar horários' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    const hoursBody = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH')?.[1]
      ?.body as string;
    expect(JSON.parse(hoursBody).operatingHours.monday.closed).toBe(true);

    cleanup();
    vi.clearAllMocks();
    renderForm('appearance');
    expect(await screen.findByRole('heading', { name: 'Aparência' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar cor #3f7652' }));
    fireEvent.click(screen.getByRole('button', { name: 'Escuro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar aparência' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    const appearanceBody = fetchMock.mock.calls.find(
      ([, options]) => options?.method === 'PATCH',
    )?.[1]?.body as string;
    expect(JSON.parse(appearanceBody).theme).toEqual({ mode: 'DARK', primaryColor: '#3f7652' });
  });

  it('uploads and removes establishment assets with the selected kind', async () => {
    const withLogo = { ...settings, logo: { kind: 'logo', url: 'https://cdn/logo.png' } };
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return response(withLogo);
      if (options?.method === 'DELETE') return response(settings);
      return response(settings);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderForm('info');
    await screen.findByDisplayValue('Pratto Burger');
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/assets/logo`),
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      ),
    );
    expect(await screen.findByRole('button', { name: 'Remover' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/assets/logo`),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('renders a stable error and retry affordance when settings cannot be loaded', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response({ code: 'SERVICE_UNAVAILABLE', message: 'Falha temporária' }, 503),
      );
    vi.stubGlobal('fetch', fetchMock);

    renderForm('info');

    expect(await screen.findByText('Falha temporária')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
