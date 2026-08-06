import type { Environment } from '@pratto/config';
import type { Request, Response } from 'express';

import { CSRF_COOKIE, SESSION_COOKIE } from '../domain/auth.constants';

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(pair.slice(separator + 1).trim());
  }
  return undefined;
}

export function setSessionCookie(
  response: Response,
  environment: Environment,
  token: string,
  expiresAt: Date,
): void {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: environment.COOKIE_SECURE,
    path: '/',
    expires: expiresAt,
  });
}

export function setCsrfCookie(
  response: Response,
  environment: Environment,
  token: string,
  expiresAt: Date,
): void {
  response.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: environment.COOKIE_SECURE,
    path: '/',
    expires: expiresAt,
  });
}

export function clearAuthCookies(response: Response, environment: Environment): void {
  const options = { sameSite: 'lax' as const, secure: environment.COOKIE_SECURE, path: '/' };
  response.clearCookie(SESSION_COOKIE, { ...options, httpOnly: true });
  response.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
}
