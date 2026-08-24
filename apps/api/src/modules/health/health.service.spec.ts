import type { EmailService, StorageService } from '@pratto/contracts';
import { prisma } from '@pratto/database';

import { HealthService } from './health.service';

describe('HealthService', () => {
  const storage: StorageService = {
    upload: jest.fn(),
    delete: jest.fn(),
    getPublicUrl: jest.fn(),
    getReadUrl: jest.fn(),
    health: jest.fn(),
  };
  const email: EmailService = { send: jest.fn(), health: jest.fn() };
  let service: HealthService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(prisma, '$queryRaw').mockResolvedValue([]);
    (storage.health as jest.Mock).mockResolvedValue(undefined);
    (email.health as jest.Mock).mockResolvedValue(undefined);
    service = new HealthService(storage, email);
  });
  afterEach(() => jest.restoreAllMocks());

  it('reports all dependencies up and returns operational metadata', async () => {
    await expect(service.check()).resolves.toMatchObject({
      status: 'ok',
      version: '0.1.0',
      uptimeSeconds: expect.any(Number),
      timestamp: expect.any(String),
      dependencies: {
        database: { status: 'up' },
        storage: { status: 'up' },
        email: { status: 'up' },
      },
    });
  });

  it('degrades safely and does not expose dependency exception details', async () => {
    (storage.health as jest.Mock).mockRejectedValue(new Error('secret connection string'));
    await expect(service.check()).resolves.toMatchObject({
      status: 'degraded',
      dependencies: { storage: { status: 'down', message: 'Dependency check failed' } },
    });
  });
});
