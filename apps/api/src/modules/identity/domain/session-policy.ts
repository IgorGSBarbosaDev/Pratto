import { SESSION_IDLE_TTL_MS, SESSION_RENEWAL_INTERVAL_MS } from './auth.constants';

export function isSessionExpired(expiresAt: Date, absoluteExpiresAt: Date, now: Date): boolean {
  return expiresAt <= now || absoluteExpiresAt <= now;
}

export function shouldRenewSession(activityReference: Date, now: Date): boolean {
  return now.getTime() - activityReference.getTime() >= SESSION_RENEWAL_INTERVAL_MS;
}

export function renewedSessionExpiration(now: Date, absoluteExpiresAt: Date): Date {
  return new Date(Math.min(now.getTime() + SESSION_IDLE_TTL_MS, absoluteExpiresAt.getTime()));
}
