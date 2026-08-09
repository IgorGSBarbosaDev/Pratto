import type { PublicMenuPageResponse } from '@pratto/contracts';
import type { Metadata } from 'next';

import { buildPublicMenuUrl } from './public-url';

function metadataBase(baseUrl: string): URL {
  try {
    return new URL(baseUrl);
  } catch {
    return new URL('http://localhost:3000');
  }
}

export function publicMenuMetadataBaseUrl(): string {
  return process.env.PUBLIC_MENU_BASE_URL || process.env.WEB_URL || 'http://localhost:3000';
}

export function createPublicMenuMetadata(
  baseUrl: string,
  publicId: string,
  page: PublicMenuPageResponse,
): Metadata {
  const title = `${page.establishment.name} · ${page.menu.name}`;
  const description =
    page.establishment.description ?? `Confira o cardápio de ${page.establishment.name}.`;
  const url = buildPublicMenuUrl(baseUrl, publicId, page.establishment.slug);
  const image = page.establishment.coverImage ?? page.establishment.logo;

  return {
    metadataBase: metadataBase(baseUrl),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: 'Pratto',
      title,
      description,
      url,
      ...(image ? { images: [{ url: image.url, alt: page.establishment.name }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image.url] } : {}),
    },
    robots: { index: true, follow: true },
  };
}

export function createPublicMenuErrorMetadata(baseUrl: string, code: string | undefined): Metadata {
  const title =
    code === 'PUBLIC_MENU_NOT_PUBLISHED'
      ? 'Cardápio ainda não publicado'
      : code === 'PUBLIC_MENU_SUSPENDED'
        ? 'Cardápio temporariamente indisponível'
        : code === 'PUBLIC_MENU_NOT_FOUND'
          ? 'Cardápio não encontrado'
          : 'Cardápio digital';

  return {
    metadataBase: metadataBase(baseUrl),
    title,
    description: 'Cardápio digital visual e mobile-first.',
    robots: { index: false, follow: false },
  };
}
