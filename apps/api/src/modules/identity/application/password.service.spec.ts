import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with Argon2id and verifies the original Unicode password', async () => {
    const password = 'senha longa com 🍽️';
    const passwordHash = await service.hash(password);

    expect(passwordHash).toContain('$argon2id$');
    await expect(service.verify(passwordHash, password)).resolves.toBe(true);
    await expect(service.verify(passwordHash, `${password}!`)).resolves.toBe(false);
  });

  it('performs a dummy verification when no credential exists', async () => {
    await expect(service.verify(undefined, 'a-password-that-does-not-exist')).resolves.toBe(false);
  });
});
