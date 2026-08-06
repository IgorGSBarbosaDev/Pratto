import { Injectable } from '@nestjs/common';
import { hash, verify } from 'argon2';

const OPTIONS = { type: 2, memoryCost: 19 * 1024, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  private readonly dummyHash = hash('pratto-dummy-password-never-used', OPTIONS);

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  verify(passwordHash: string | undefined, password: string): Promise<boolean> {
    return this.verifySafely(passwordHash, password);
  }

  private async verifySafely(passwordHash: string | undefined, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash ?? (await this.dummyHash), password);
    } catch {
      return false;
    }
  }
}
