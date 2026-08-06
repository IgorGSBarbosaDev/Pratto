import { createCsrfToken, createOpaqueToken, keyedHash, verifyCsrfToken } from './auth.crypto';

describe('authentication cryptography', () => {
  const secret = 'a-test-cookie-secret-with-more-than-thirty-two-characters';

  it('creates 32-byte opaque tokens without persisting their raw value', () => {
    const first = createOpaqueToken();
    const second = createOpaqueToken();

    expect(Buffer.from(first, 'base64url')).toHaveLength(32);
    expect(first).not.toBe(second);
    expect(keyedHash(secret, 'session', first)).toMatch(/^[a-f0-9]{64}$/);
    expect(keyedHash(secret, 'session', first)).not.toBe(
      keyedHash(secret, 'password-reset', first),
    );
  });

  it('binds a signed CSRF proof to one internal session', () => {
    const token = createCsrfToken(secret, 'session-a');

    expect(verifyCsrfToken(secret, 'session-a', token)).toBe(true);
    expect(verifyCsrfToken(secret, 'session-b', token)).toBe(false);
    expect(verifyCsrfToken(secret, 'session-a', `${token}changed`)).toBe(false);
  });
});
