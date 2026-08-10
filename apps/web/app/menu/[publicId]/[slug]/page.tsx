import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import {
  createPublicMenuErrorMetadata,
  createPublicMenuMetadata,
  publicMenuMetadataBaseUrl,
} from '../../../../features/public-menu/metadata';
import { PublicMenuScreen } from '../../../../features/public-menu/public-menu-screen';
import {
  buildPublicMenuUrl,
  buildPublicProductUrl,
} from '../../../../features/public-menu/public-url';
import { fetchPublicMenuPage } from '../../../../features/public-menu/server-api';

const PAGE_SIZE = 6;

interface PublicMenuRouteProps {
  params: Promise<{ publicId: string; slug: string }>;
  searchParams: Promise<{ product?: string | string[] }>;
}

export async function generateMetadata({ params }: PublicMenuRouteProps): Promise<Metadata> {
  const { publicId } = await params;
  const result = await fetchPublicMenuPage(publicId, PAGE_SIZE);
  return result.page
    ? createPublicMenuMetadata(publicMenuMetadataBaseUrl(), publicId, result.page)
    : createPublicMenuErrorMetadata(publicMenuMetadataBaseUrl(), result.error?.code);
}

export default async function PublicMenuPage({ params, searchParams }: PublicMenuRouteProps) {
  const { publicId, slug } = await params;
  const { product } = await searchParams;
  const initialProductId = validProductId(product);
  const result = await fetchPublicMenuPage(publicId, PAGE_SIZE);

  if (result.error?.code === 'PUBLIC_MENU_NOT_FOUND') notFound();
  if (result.page && result.page.establishment.slug !== slug) {
    redirect(
      initialProductId
        ? buildPublicProductUrl(
            publicMenuMetadataBaseUrl(),
            publicId,
            result.page.establishment.slug,
            initialProductId,
          )
        : buildPublicMenuUrl(publicMenuMetadataBaseUrl(), publicId, result.page.establishment.slug),
    );
  }

  return (
    <PublicMenuScreen
      publicId={publicId}
      slug={slug}
      initialPage={result.page}
      initialError={result.error}
      initialProductId={initialProductId}
    />
  );
}

function validProductId(value: string | string[] | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const productId = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    productId,
  )
    ? productId
    : undefined;
}
