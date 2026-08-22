import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

type Purpose = 'session' | 'password-reset' | 'rate-limit' | 'csrf' | 'invitation';

function deriveKey(secret: string, purpose: Purpose): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(secret),
      Buffer.from('pratto-auth-v1'),
      Buffer.from(purpose),
      32,
    ),
  );
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function keyedHash(secret: string, purpose: Purpose, value: string): string {
  return createHmac('sha256', deriveKey(secret, purpose)).update(value).digest('hex');
}

export function createCsrfToken(secret: string, sessionId: string): string {
  const nonce = createOpaqueToken();
  const signature = keyedHash(secret, 'csrf', `${sessionId}.${nonce}`);
  return `${nonce}.${signature}`;
}

export function verifyCsrfToken(secret: string, sessionId: string, token: string): boolean {
  const [nonce, signature, extra] = token.split('.');
  if (!nonce || !signature || extra) return false;
  const expected = keyedHash(secret, 'csrf', `${sessionId}.${nonce}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
