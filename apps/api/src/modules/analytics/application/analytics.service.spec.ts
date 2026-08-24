import { createHash } from 'node:crypto';

import type { AnalyticsSessionInput } from '@pratto/validation';

const mockPrisma = {
  establishment: { findFirst: jest.fn() },
  analyticsSession: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  menuPublication: { findFirst: jest.fn() },
  analyticsEvent: { findUnique: jest.fn(), create: jest.fn() },
};

jest.mock('@pratto/database', () => ({
  ...jest.requireActual('@pratto/database'),
  prisma: mockPrisma,
}));

import { StableHttpException } from '../../../common/http/stable-http.exception';

import { AnalyticsService, AnalyticsServiceError, mapAnalyticsError } from './analytics.service';

const establishment = { id: 'establishment-id', organizationId: 'organization-id' };
const future = new Date(Date.now() + 10 * 60 * 1000);
const nowIso = new Date().toISOString();
const session = {
  id: 'session-id',
  organizationId: 'organization-id',
  establishmentId: 'establishment-id',
  expiresAt: future,
};
const snapshot = {
  categories: [{ id: 'category-id' }],
  products: [
    { id: 'product-id', categoryId: 'category-id', availability: 'AVAILABLE' },
    { id: 'hidden-product', categoryId: 'category-id', availability: 'HIDDEN' },
  ],
};

function event(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'event-id',
    publicationId: 'publication-id',
    occurredAt: nowIso,
    eventType: 'menu_opened',
    ...overrides,
  };
}

function ingestInput(events = [event()]) {
  return {
    establishmentPublicId: 'public-id',
    sessionId: 'session-id',
    events,
  } as never;
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  const rateLimit = { consume: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsService(rateLimit as never);
    mockPrisma.establishment.findFirst.mockResolvedValue(establishment);
    mockPrisma.analyticsSession.findUnique.mockResolvedValue(session);
    mockPrisma.analyticsSession.create.mockResolvedValue({ id: 'new-session', expiresAt: future });
    mockPrisma.analyticsSession.update.mockResolvedValue({ ...session, expiresAt: future });
    mockPrisma.menuPublication.findFirst.mockResolvedValue({
      id: 'publication-id',
      menuId: 'menu-id',
      snapshot,
    });
    mockPrisma.analyticsEvent.findUnique.mockResolvedValue(null);
    mockPrisma.analyticsEvent.create.mockResolvedValue({});
  });

  it('creates a session and refreshes an unexpired session for the same establishment', async () => {
    await expect(
      service.createOrReuseSession(
        { establishmentPublicId: 'public-id' } as AnalyticsSessionInput,
        'ip-hash',
      ),
    ).resolves.toMatchObject({ sessionId: 'new-session', expiresAt: future.toISOString() });
    expect(rateLimit.consume).toHaveBeenCalledWith('analytics-session-ip', 'ip-hash', 10);
    expect(mockPrisma.analyticsSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'organization-id',
          establishmentId: 'establishment-id',
        }),
      }),
    );

    mockPrisma.analyticsSession.findUnique.mockResolvedValue(session);
    await expect(
      service.createOrReuseSession(
        { establishmentPublicId: 'public-id', sessionId: 'session-id' },
        'ip-hash',
      ),
    ).resolves.toMatchObject({ sessionId: 'session-id' });
    expect(mockPrisma.analyticsSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-id' },
        data: expect.objectContaining({ lastSeenAt: expect.any(Date) }),
      }),
    );
  });

  it('rejects an anonymous session reused across establishments and maps missing establishments', async () => {
    mockPrisma.analyticsSession.findUnique.mockResolvedValue({
      ...session,
      establishmentId: 'other-establishment',
      organizationId: 'other-organization',
    });
    await expect(
      service.createOrReuseSession(
        { establishmentPublicId: 'public-id', sessionId: 'session-id' },
        'ip',
      ),
    ).rejects.toMatchObject({ code: 'ANALYTICS_SESSION_INVALID' });

    mockPrisma.establishment.findFirst.mockResolvedValue(null);
    await expect(
      service.createOrReuseSession({ establishmentPublicId: 'missing' }, 'ip'),
    ).rejects.toMatchObject({ code: 'ANALYTICS_ESTABLISHMENT_NOT_FOUND' });
  });

  it('accepts valid events, refreshes the session and sends the complete persistence shape', async () => {
    const events = [
      event(),
      event({
        eventId: 'impression-id',
        eventType: 'product_impression',
        productId: 'product-id',
        intersectionRatio: 0.5,
        durationMs: 500,
      }),
      event({
        eventId: 'view-id',
        eventType: 'product_viewed',
        productId: 'product-id',
        intersectionRatio: 0.7,
        durationMs: 2000,
      }),
      event({
        eventId: 'interaction-id',
        eventType: 'product_interaction',
        productId: 'product-id',
        interactionType: 'details_opened',
      }),
      event({
        eventId: 'category-id-event',
        eventType: 'category_selected',
        categoryId: 'category-id',
      }),
      event({ eventId: 'contact-id', eventType: 'contact_clicked', contactType: 'whatsapp' }),
    ];
    await expect(service.ingest(ingestInput(events), 'ip-hash')).resolves.toEqual({
      results: events.map((item) => ({ eventId: item.eventId, status: 'accepted' })),
    });
    expect(rateLimit.consume).toHaveBeenNthCalledWith(1, 'analytics-ingest-ip', 'ip-hash', 60);
    expect(rateLimit.consume).toHaveBeenNthCalledWith(
      2,
      'analytics-events-session',
      'session-id',
      300,
      events.length,
    );
    expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledTimes(events.length);
    expect(mockPrisma.analyticsEvent.create.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'PRODUCT_IMPRESSION',
          productId: 'product-id',
          categoryId: 'category-id',
          intersectionRatio: expect.anything(),
          durationMs: 500,
        }),
      }),
    );
    expect(mockPrisma.analyticsSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-id' },
        data: expect.objectContaining({ expiresAt: expect.any(Date) }),
      }),
    );
  });

  it('deduplicates identical events and rejects idempotency conflicts and invalid targets', async () => {
    const existing = event();
    mockPrisma.analyticsEvent.findUnique.mockResolvedValueOnce({
      payloadHash: createHash('sha256').update(JSON.stringify(existing)).digest('hex'),
    });
    await expect(service.ingest(ingestInput([existing]), 'ip')).resolves.toEqual({
      results: [{ eventId: 'event-id', status: 'duplicate' }],
    });

    mockPrisma.analyticsEvent.findUnique.mockResolvedValueOnce({ payloadHash: 'different' });
    await expect(
      service.ingest(ingestInput([event({ eventId: 'conflict-id' })]), 'ip'),
    ).resolves.toEqual({
      results: [
        { eventId: 'conflict-id', status: 'rejected', code: 'ANALYTICS_IDEMPOTENCY_CONFLICT' },
      ],
    });

    mockPrisma.analyticsEvent.findUnique.mockResolvedValue(null);
    await expect(
      service.ingest(
        ingestInput([
          event({
            eventId: 'hidden-id',
            eventType: 'product_interaction',
            productId: 'hidden-product',
            interactionType: 'details_opened',
          }),
        ]),
        'ip',
      ),
    ).resolves.toEqual({
      results: [{ eventId: 'hidden-id', status: 'rejected', code: 'ANALYTICS_PRODUCT_INVALID' }],
    });
    await expect(
      service.ingest(
        ingestInput([
          event({
            eventId: 'bad-category',
            eventType: 'category_selected',
            categoryId: 'missing-category',
          }),
        ]),
        'ip',
      ),
    ).resolves.toEqual({
      results: [
        { eventId: 'bad-category', status: 'rejected', code: 'ANALYTICS_CATEGORY_INVALID' },
      ],
    });
    expect(mockPrisma.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it('enforces event qualification thresholds and timestamp bounds', async () => {
    const invalid = [
      event({ eventId: 'old', occurredAt: new Date(Date.now() - 16 * 60 * 1000).toISOString() }),
      event({ eventId: 'future', occurredAt: new Date(Date.now() + 3 * 60 * 1000).toISOString() }),
      event({
        eventId: 'weak-impression',
        eventType: 'product_impression',
        productId: 'product-id',
        intersectionRatio: 0.49,
        durationMs: 500,
      }),
      event({
        eventId: 'weak-view',
        eventType: 'product_viewed',
        productId: 'product-id',
        intersectionRatio: 0.7,
        durationMs: 1999,
      }),
    ];
    await expect(service.ingest(ingestInput(invalid), 'ip')).resolves.toEqual({
      results: [
        { eventId: 'old', status: 'rejected', code: 'ANALYTICS_EVENT_TIME_OUT_OF_RANGE' },
        { eventId: 'future', status: 'rejected', code: 'ANALYTICS_EVENT_TIME_OUT_OF_RANGE' },
        {
          eventId: 'weak-impression',
          status: 'rejected',
          code: 'ANALYTICS_IMPRESSION_RULE_NOT_MET',
        },
        { eventId: 'weak-view', status: 'rejected', code: 'ANALYTICS_QUALIFIED_VIEW_RULE_NOT_MET' },
      ],
    });
    expect(mockPrisma.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it('rejects expired or cross-establishment sessions and turns persistence failures into stable errors', async () => {
    mockPrisma.analyticsSession.findUnique.mockResolvedValue({
      ...session,
      expiresAt: new Date(Date.now() - 1),
    });
    await expect(service.ingest(ingestInput(), 'ip')).rejects.toMatchObject({
      code: 'ANALYTICS_SESSION_INVALID',
    });

    mockPrisma.analyticsSession.findUnique.mockResolvedValue(session);
    mockPrisma.establishment.findFirst.mockResolvedValue({
      id: 'other-id',
      organizationId: 'other-org',
    });
    await expect(service.ingest(ingestInput(), 'ip')).rejects.toMatchObject({
      code: 'ANALYTICS_SESSION_INVALID',
    });

    mockPrisma.establishment.findFirst.mockResolvedValue(establishment);
    mockPrisma.analyticsEvent.create.mockRejectedValue(new Error('database unavailable'));
    await expect(service.ingest(ingestInput(), 'ip')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ANALYTICS_UNAVAILABLE', statusCode: 503 }),
    });
  });

  it('maps domain errors without hiding unrelated exceptions', () => {
    expect(() =>
      mapAnalyticsError(new AnalyticsServiceError('ANALYTICS_SESSION_INVALID', 'invalid')),
    ).toThrow(expect.objectContaining({ response: expect.objectContaining({ statusCode: 404 }) }));
    const unrelated = new Error('unrelated');
    expect(() => mapAnalyticsError(unrelated)).toThrow(unrelated);
    expect(new StableHttpException(400, 'x', 'x').getStatus()).toBe(400);
  });
});
