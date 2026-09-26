import { beforeEach, describe, expect, it, vi } from 'vitest';

import { analyticsApi } from '../features/analytics/api-client';
import type { ApiClientError } from '../features/auth/api-client';
import { authApi, publicRequest, request } from '../features/auth/api-client';
import { catalogApi } from '../features/catalog/api-client';
import { establishmentApi } from '../features/establishments/api-client';
import { publicMenuApi } from '../features/public-menu/api-client';
import { teamApi } from '../features/team/api-client';

const fetchMock = vi.fn();

function response(body: unknown, init: ResponseInit = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function fetchCall(index: number): [string, RequestInit] {
  return fetchMock.mock.calls[index] as [string, RequestInit];
}

describe('web API clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = 'pratto_csrf=csrf-token';
  });

  it('sends JSON, credentials, no-store and CSRF headers, including the lazy token fallback', async () => {
    fetchMock.mockResolvedValueOnce(response({ ok: true }));
    await request('/admin/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'Casa' }),
      csrf: true,
    });
    const [, init] = fetchCall(0);
    expect(init.credentials).toBe('include');
    expect(init.cache).toBe('no-store');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(new Headers(init.headers).get('x-csrf-token')).toBe('csrf-token');

    document.cookie = 'pratto_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(response({ csrfToken: 'fresh-token' }));
    fetchMock.mockResolvedValueOnce(response(undefined, { status: 204 }));
    await request('/admin/test', { method: 'DELETE', csrf: true });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/auth/csrf'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(new Headers(fetchCall(1)[1].headers).get('x-csrf-token')).toBe('fresh-token');
  });

  it('maps API errors to stable ApiClientError values and omits credentials for public requests', async () => {
    fetchMock.mockResolvedValueOnce(
      response(
        { code: 'MENU_NOT_FOUND', message: 'missing', details: { id: 'x' } },
        { status: 404 },
      ),
    );
    await expect(request('/public/failure')).rejects.toEqual(
      expect.objectContaining({
        statusCode: 404,
        code: 'MENU_NOT_FOUND',
        message: 'missing',
        details: { id: 'x' },
      } satisfies Partial<ApiClientError>),
    );
    fetchMock.mockResolvedValueOnce(response({ page: true }));
    await publicRequest('/public/menu');
    expect(fetchCall(1)[1]).toMatchObject({ credentials: 'omit', cache: 'no-store' });
  });

  it('keeps auth and establishment mutations on the documented routes and methods', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(response({ ok: true })));
    await authApi.login({ email: 'user@example.com', password: 'password' });
    await authApi.selectOrganization('membership-id');
    await authApi.logout();
    await establishmentApi.update('establishment-id', { name: 'Casa' });
    await establishmentApi.uploadAsset(
      'establishment-id',
      'logo',
      new File(['logo'], 'logo.png', { type: 'image/png' }),
    );
    await establishmentApi.removeAsset('establishment-id', 'logo');
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['http://localhost:4000/auth/login', 'POST'],
      ['http://localhost:4000/auth/select-organization', 'POST'],
      ['http://localhost:4000/auth/logout', 'POST'],
      ['http://localhost:4000/admin/establishments/establishment-id/settings', 'PATCH'],
      ['http://localhost:4000/admin/establishments/establishment-id/assets/logo', 'POST'],
      ['http://localhost:4000/admin/establishments/establishment-id/assets/logo', 'DELETE'],
    ]);
    expect(fetchCall(4)[1].body).toBeInstanceOf(FormData);
  });

  it('preserves catalog, team, analytics and public-menu contracts including idempotency and encoding', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(response({ ok: true })));
    await catalogApi.publishMenu('menu-id', 'publication-key');
    await catalogApi.createProduct('menu-id', {
      categoryId: 'category-id',
      name: 'Prato',
      price: '10.00',
    });
    await catalogApi.uploadProductMedia(
      'menu-id',
      'product-id',
      new File(['x'], 'x.png', { type: 'image/png' }),
    );
    await teamApi.invite('establishment-id', { email: 'person@example.com', role: 'MEMBER' });
    await teamApi.updateRole('establishment-id', 'membership-id', 'ADMIN');
    await analyticsApi.getDashboard('establishment-id', {
      fromDate: '2026-08-01',
      toDate: '2026-08-02',
      productId: 'product-id',
    });
    await publicMenuApi.getPage('Casa Aurora/centro', { search: 'pão de queijo', limit: 12 });
    await publicMenuApi.getRelated('Casa Aurora/centro', 'produto/1');
    expect(new Headers(fetchCall(0)[1].headers).get('idempotency-key')).toBe('publication-key');
    expect(fetchCall(1)[0]).toContain('/admin/menus/menu-id/products');
    expect(new Headers(fetchCall(3)[1].headers).get('x-csrf-token')).toBe('csrf-token');
    expect(fetchCall(5)[0]).toContain('productId=product-id');
    expect(fetchCall(6)[0]).toContain(encodeURIComponent('Casa Aurora/centro'));
    expect(new URL(fetchCall(6)[0]).searchParams.get('search')).toBe('pão de queijo');
    expect(fetchCall(7)[0]).toContain(encodeURIComponent('produto/1'));
  });
});
