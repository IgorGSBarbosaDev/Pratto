export function buildPublicMenuUrl(baseUrl: string, publicId: string, slug: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  } catch {
    url = new URL('http://localhost:3000/');
  }
  const basePath = url.pathname.replace(/\/+$/, '');
  url.pathname = `${basePath}/menu/${encodeURIComponent(publicId)}/${encodeURIComponent(slug)}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function buildPublicProductUrl(
  baseUrl: string,
  publicId: string,
  slug: string,
  productId: string,
): string {
  const url = new URL(buildPublicMenuUrl(baseUrl, publicId, slug));
  url.searchParams.set('product', productId);
  return url.toString();
}
