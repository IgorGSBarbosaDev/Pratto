import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_SERVICE, STORAGE_SERVICE } from '@pratto/contracts';
import type {
  EmailService,
  HealthDependency,
  HealthResponse,
  StorageService,
} from '@pratto/contracts';
import { prisma } from '@pratto/database';

type Probe = () => Promise<void>;

@Injectable()
export class HealthService {
  constructor(
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(EMAIL_SERVICE) private readonly email: EmailService,
  ) {}

  async check(): Promise<HealthResponse> {
    const dependencies = await Promise.all([
      this.probe('database', async () => {
        await prisma.$queryRaw`SELECT 1`;
      }),
      this.probe('storage', () => this.storage.health()),
      this.probe('email', () => this.email.health()),
    ]);
    const dependencyMap = Object.fromEntries(dependencies);
    const healthy = Object.values(dependencyMap).every((dependency) => dependency.status === 'up');

    return {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      version: '0.1.0',
      dependencies: dependencyMap,
    };
  }

  private async probe(name: string, operation: Probe): Promise<[string, HealthDependency]> {
    const startedAt = performance.now();
    try {
      await operation();
      return [name, { status: 'up', latencyMs: Math.round(performance.now() - startedAt) }];
    } catch {
      return [
        name,
        {
          status: 'down',
          latencyMs: Math.round(performance.now() - startedAt),
          message: this.safeMessage(),
        },
      ];
    }
  }

  private safeMessage(): string {
    return 'Dependency check failed';
  }
}
