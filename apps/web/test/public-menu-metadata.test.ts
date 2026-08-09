import type { PublicMenuPageResponse } from '@pratto/contracts';
import { describe, expect, it } from 'vitest';

import {
  createPublicMenuErrorMetadata,
  createPublicMenuMetadata,
} from '../features/public-menu/metadata';
import { buildPublicMenuUrl } from '../features/public-menu/public-url';

const page: PublicMenuPageResponse = {
  establishment: {
    publicId: 'cafe-aurora-local',
    name: 'Café Aurora',
    slug: 'cafe-aurora',
    description: 'Comida feita na hora.',
    phone: null,
    whatsapp: null,
    address: null,
    operatingHours: {} as PublicMenuPageResponse['establishment']['operatingHours'],
    logo: { url: 'https://cdn.example/logo.png', contentType: 'image/png' },
    coverImage: { url: 'https://cdn.example/cover.png', contentType: 'image/png' },
    theme: { mode: 'LIGHT' as const, primaryColor: '#166534' },
  },
  menu: {
    name: 'Menu principal',
    publicationId: '33333333-3333-4333-8333-333333333333',
    version: 1,
    publishedAt: '2026-08-09T12:00:00.000Z',
  },
  categories: [],
  products: [],
  nextCursor: null,
};

describe('public menu metadata and URL', () => {
  it('builds a stable URL with an optional deployment path and encoded segments', () => {
    expect(buildPublicMenuUrl('https://menus.example/pratto/', 'café público', 'cafe-aurora')).toBe(
      'https://menus.example/pratto/menu/caf%C3%A9%20p%C3%BAblico/cafe-aurora',
    );
    expect(buildPublicMenuUrl('not a URL', 'public-id', 'slug')).toBe(
      'http://localhost:3000/menu/public-id/slug',
    );
  });

  it('creates canonical, Open Graph and Twitter metadata for the published menu', () => {
    const metadata = createPublicMenuMetadata(
      'https://menus.example',
      page.establishment.publicId,
      page,
    );

    expect(metadata.alternates?.canonical).toBe(
      'https://menus.example/menu/cafe-aurora-local/cafe-aurora',
    );
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      locale: 'pt_BR',
      title: 'Café Aurora · Menu principal',
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Café Aurora · Menu principal',
    });
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it('marks unavailable menu states as noindex', () => {
    expect(
      createPublicMenuErrorMetadata('https://menus.example', 'PUBLIC_MENU_SUSPENDED'),
    ).toMatchObject({
      title: 'Cardápio temporariamente indisponível',
      robots: { index: false, follow: false },
    });
  });
});
