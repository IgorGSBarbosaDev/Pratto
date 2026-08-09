import type { AnalyticsIngestResponse, AnalyticsSessionResponse } from '@pratto/contracts';
import type { Request } from 'express';

import type { AnalyticsService } from '../application/analytics.service';

import { AnalyticsController } from './analytics.controller';

const session: AnalyticsSessionResponse = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  expiresAt: '2026-08-09T12:30:00.000Z',
};
const ingestion: AnalyticsIngestResponse = {
  results: [{ eventId: '22222222-2222-4222-8222-222222222222', status: 'accepted' }],
};

describe('AnalyticsController', () => {
  it('accepts public session creation without an authenticated request', async () => {
    const createOrReuseSession = jest.fn().mockResolvedValue(session);
    const controller = new AnalyticsController({
      createOrReuseSession,
    } as unknown as AnalyticsService);

    await expect(
      controller.createSession({ establishmentPublicId: 'cafe-aurora-local' }, {
        ip: '127.0.0.1',
      } as Request),
    ).resolves.toBe(session);
    expect(createOrReuseSession).toHaveBeenCalledWith(
      { establishmentPublicId: 'cafe-aurora-local' },
      '127.0.0.1',
    );
  });

  it('rejects invalid batches before calling the service', () => {
    const ingest = jest.fn();
    const controller = new AnalyticsController({ ingest } as unknown as AnalyticsService);

    expect(() =>
      controller.ingest(
        {
          establishmentPublicId: 'cafe-aurora-local',
          sessionId: 'not-a-uuid',
          events: [],
        },
        { ip: '127.0.0.1' } as Request,
      ),
    ).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'VALIDATION_ERROR' }) }),
    );
    expect(ingest).not.toHaveBeenCalled();
  });

  it('delegates a valid batch and preserves per-event results', async () => {
    const ingest = jest.fn().mockResolvedValue(ingestion);
    const controller = new AnalyticsController({ ingest } as unknown as AnalyticsService);
    const body = {
      establishmentPublicId: 'cafe-aurora-local',
      sessionId: session.sessionId,
      events: [
        {
          eventId: '22222222-2222-4222-8222-222222222222',
          eventType: 'menu_opened',
          publicationId: '33333333-3333-4333-8333-333333333333',
          occurredAt: '2026-08-09T12:00:00.000Z',
        },
      ],
    };

    await expect(controller.ingest(body, { ip: '127.0.0.1' } as Request)).resolves.toBe(ingestion);
    expect(ingest).toHaveBeenCalledWith(body, '127.0.0.1');
  });
});
