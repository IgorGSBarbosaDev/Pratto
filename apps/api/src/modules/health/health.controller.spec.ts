import { Test } from '@nestjs/testing';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('returns the health service result', async () => {
    const result = {
      status: 'ok' as const,
      timestamp: '2026-08-05T00:00:00.000Z',
      uptimeSeconds: 1,
      version: '0.1.0',
      dependencies: {},
    };
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthService, useValue: { check: jest.fn().mockResolvedValue(result) } },
      ],
    }).compile();
    const controller = module.get(HealthController);

    await expect(controller.check()).resolves.toEqual(result);
  });
});
