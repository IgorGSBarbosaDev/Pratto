import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicMenuShare } from '../features/public-menu/public-menu-share';

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async () => 'data:image/png;base64,qr-png'),
    toString: vi.fn(async () => '<svg aria-label="qr"></svg>'),
  },
}));

const settings = {
  id: '11111111-1111-4111-8111-111111111111',
  publicId: 'café público',
  name: 'Café Aurora',
  slug: 'cafe-aurora',
  description: null,
  phone: null,
  whatsapp: null,
  address: null,
  operatingHours: {},
  logo: null,
  coverImage: null,
  theme: { mode: 'LIGHT', primaryColor: '#166534' },
};

function renderShare() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicMenuShare establishmentId={settings.id} publicMenuBaseUrl="http://localhost:3100" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(settings), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => cleanup());

describe('PublicMenuShare', () => {
  it('renders the public URL and downloadable PNG and SVG QR artifacts', async () => {
    renderShare();

    expect(
      await screen.findByAltText('QR Code para o cardápio de Café Aurora'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cafe-aurora$/ })).toHaveAttribute(
      'href',
      'http://localhost:3100/menu/caf%C3%A9%20p%C3%BAblico/cafe-aurora',
    );
    expect(screen.getByRole('link', { name: 'Baixar PNG' })).toHaveAttribute(
      'download',
      'cafe-aurora-cardapio-qr.png',
    );
    expect(screen.getByRole('link', { name: 'Baixar SVG' })).toHaveAttribute(
      'download',
      'cafe-aurora-cardapio-qr.svg',
    );
  });

  it('uses Web Share when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    renderShare();

    await screen.findByAltText('QR Code para o cardápio de Café Aurora');
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar link' }));

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Cardápio de Café Aurora',
          url: 'http://localhost:3100/menu/caf%C3%A9%20p%C3%BAblico/cafe-aurora',
        }),
      ),
    );
    expect(await screen.findByText('Link compartilhado.')).toBeInTheDocument();
  });

  it('falls back to copying the public URL', async () => {
    renderShare();
    await screen.findByAltText('QR Code para o cardápio de Café Aurora');
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar link' }));

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'http://localhost:3100/menu/caf%C3%A9%20p%C3%BAblico/cafe-aurora',
      ),
    );
    expect(
      await screen.findByText('Link copiado para a área de transferência.'),
    ).toBeInTheDocument();
  });
});
