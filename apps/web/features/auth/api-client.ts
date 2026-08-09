import type { ApiError, AuthContextResponse, CsrfResponse } from '@pratto/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiClientError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const pair of document.cookie.split(';')) {
    const [key, ...value] = pair.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

export async function request<T>(
  path: string,
  options: RequestInit & { csrf?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(typeof FormData !== 'undefined' && options.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }
  if (options.csrf) {
    let token = readCookie('pratto_csrf');
    if (!token) token = (await request<CsrfResponse>('/auth/csrf')).csrfToken;
    headers.set('x-csrf-token', token);
  }
  const fetchOptions = { ...options };
  delete fetchOptions.csrf;
  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => undefined)) as ApiError | undefined;
    throw new ApiClientError(
      response.status,
      error?.code ?? 'REQUEST_ERROR',
      error?.message ?? 'Não foi possível concluir a solicitação.',
      error?.details,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const authApi = {
  login: (input: { email: string; password: string }) =>
    request<AuthContextResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  me: () => request<AuthContextResponse>('/auth/me'),
  selectOrganization: (membershipId: string) =>
    request<AuthContextResponse>('/auth/select-organization', {
      method: 'POST',
      body: JSON.stringify({ membershipId }),
      csrf: true,
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST', csrf: true }),
  logoutAll: () => request<void>('/auth/logout-all', { method: 'POST', csrf: true }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<void>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
};
