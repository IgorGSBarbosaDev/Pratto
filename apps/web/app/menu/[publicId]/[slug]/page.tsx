import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import {
  createPublicMenuErrorMetadata,
  createPublicMenuMetadata,
  publicMenuMetadataBaseUrl,
} from '../../../../features/public-menu/metadata';
import { PublicMenuScreen } from '../../../../features/public-menu/public-menu-screen';
import { buildPublicMenuUrl } from '../../../../features/public-menu/public-url';
import { fetchPublicMenuPage } from '../../../../features/public-menu/server-api';

const PAGE_SIZE = 6;

interface PublicMenuRouteProps {
  params: Promise<{ publicId: string; slug: string }>;
}

export async function generateMetadata({ params }: PublicMenuRouteProps): Promise<Metadata> {
  const { publicId } = await params;
  const result = await fetchPublicMenuPage(publicId, PAGE_SIZE);
  return result.page
    ? createPublicMenuMetadata(publicMenuMetadataBaseUrl(), publicId, result.page)
    : createPublicMenuErrorMetadata(publicMenuMetadataBaseUrl(), result.error?.code);
}

export default async function PublicMenuPage({ params }: PublicMenuRouteProps) {
  const { publicId, slug } = await params;
  const result = await fetchPublicMenuPage(publicId, PAGE_SIZE);

  if (result.error?.code === 'PUBLIC_MENU_NOT_FOUND') notFound();
  if (result.page && result.page.establishment.slug !== slug) {
    redirect(
      buildPublicMenuUrl(publicMenuMetadataBaseUrl(), publicId, result.page.establishment.slug),
    );
  }

  return (
    <PublicMenuScreen
      publicId={publicId}
      slug={slug}
      initialPage={result.page}
      initialError={result.error}
    />
  );
}
