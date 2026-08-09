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
