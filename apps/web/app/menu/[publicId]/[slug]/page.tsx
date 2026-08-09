import { PublicMenuScreen } from '../../../../features/public-menu/public-menu-screen';

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ publicId: string; slug: string }>;
}) {
  const { publicId, slug } = await params;
  return <PublicMenuScreen publicId={publicId} slug={slug} />;
}
