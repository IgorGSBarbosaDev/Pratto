import { randomUUID } from 'node:crypto';

import { ProductAvailability, PrismaClient } from '@prisma/client';

import { AnalyticsQueryService } from '../../../../apps/api/src/modules/analytics/application/analytics-query.service';
import { AnalyticsRateLimitService } from '../../../../apps/api/src/modules/analytics/application/analytics-rate-limit.service';
import { AnalyticsRetentionService } from '../../../../apps/api/src/modules/analytics/application/analytics-retention.service';
import {
  AnalyticsService,
  AnalyticsServiceError,
} from '../../../../apps/api/src/modules/analytics/application/analytics.service';
import { CatalogMenuSnapshotSource } from '../../../../apps/api/src/modules/catalog/application/catalog-menu-snapshot-source';
import { MenuPublicationService } from '../../src/menu-publication';
import { clearDatabase, createAnalyticsSession, createTenantFixture } from '../../src/testing';

const database = new PrismaClient();

async function createPublishedAnalyticsFixture(
  label: string,
  options: { includeSecondProduct?: boolean } = {},
) {
  const tenant = await createTenantFixture(database, { label });
  const category = await database.category.create({
    data: {
      organizationId: tenant.organization.id,
      menuId: tenant.menu.id,
      name: 'Pratos',
      normalizedName: `pratos-${label.toLowerCase().replaceAll(' ', '-')}`,
    },
  });
  const product = await database.product.create({
    data: {
      organizationId: tenant.organization.id,
      menuId: tenant.menu.id,
      categoryId: category.id,
      name: 'Produto público',
      price: '29.90',
      availability: ProductAvailability.AVAILABLE,
    },
  });
  const secondCategory = options.includeSecondProduct
    ? await database.category.create({
        data: {
          organizationId: tenant.organization.id,
          menuId: tenant.menu.id,
          name: 'Bebidas',
          normalizedName: `bebidas-${label.toLowerCase().replaceAll(' ', '-')}`,
        },
      })
    : undefined;
  const secondProduct = secondCategory
    ? await database.product.create({
        data: {
          organizationId: tenant.organization.id,
          menuId: tenant.menu.id,
          categoryId: secondCategory.id,
          name: 'Segundo produto público',
          price: '9.90',
          availability: ProductAvailability.AVAILABLE,
        },
      })
    : undefined;
  const publication = await new MenuPublicationService(
    database,
    new CatalogMenuSnapshotSource(),
  ).publish({
    menuId: tenant.menu.id,
    tenant: { organizationId: tenant.organization.id, userId: tenant.user.id },
    idempotencyKey: `analytics-${label}`,
  });
  return { tenant, category, product, secondCategory, secondProduct, publication };
}

function eventBase(publicationId: string) {
  return {
    publicationId,
    occurredAt: new Date().toISOString(),
  };
}

describe('public menu analytics integration', () => {
  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it('creates, resumes, expires and isolates anonymous sessions', async () => {
    const first = await createPublishedAnalyticsFixture('Session A');
    const second = await createPublishedAnalyticsFixture('Session B');
    const service = new AnalyticsService(new AnalyticsRateLimitService());

    const created = await service.createOrReuseSession(
      { establishmentPublicId: first.tenant.establishment.publicId },
      'session-ip-a',
    );
    const reused = await service.createOrReuseSession(
      {
        establishmentPublicId: first.tenant.establishment.publicId,
        sessionId: created.sessionId,
      },
      'session-ip-a',
    );
    expect(reused.sessionId).toBe(created.sessionId);

    await expect(
      service.createOrReuseSession(
        {
          establishmentPublicId: second.tenant.establishment.publicId,
          sessionId: created.sessionId,
        },
        'session-ip-b',
      ),
    ).rejects.toBeInstanceOf(AnalyticsServiceError);

    const old = new Date(Date.now() - 60_000);
    await database.analyticsSession.update({
      where: { id: created.sessionId },
      data: {
        firstSeenAt: old,
        lastSeenAt: old,
        expiresAt: new Date(old.getTime() + 1_000),
      },
    });
    const renewed = await service.createOrReuseSession(
      {
        establishmentPublicId: first.tenant.establishment.publicId,
        sessionId: created.sessionId,
      },
      'session-ip-a',
    );
    expect(renewed.sessionId).not.toBe(created.sessionId);
  });

  it('ingests valid events, deduplicates semantic repeats and detects idempotency conflicts', async () => {
    const fixture = await createPublishedAnalyticsFixture('Ingest');
    const service = new AnalyticsService(new AnalyticsRateLimitService());
    const session = await service.createOrReuseSession(
      { establishmentPublicId: fixture.tenant.establishment.publicId },
      'ingest-ip',
    );
    const eventIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const events = [
      {
        eventId: eventIds[0]!,
        eventType: 'menu_opened' as const,
        ...eventBase(fixture.publication.id),
      },
      {
        eventId: eventIds[1]!,
        eventType: 'product_impression' as const,
        productId: fixture.product.id,
        intersectionRatio: 0.5,
        durationMs: 500,
        ...eventBase(fixture.publication.id),
      },
      {
        eventId: eventIds[2]!,
        eventType: 'product_viewed' as const,
        productId: fixture.product.id,
        intersectionRatio: 0.7,
        durationMs: 2_000,
        ...eventBase(fixture.publication.id),
      },
      {
        eventId: eventIds[3]!,
        eventType: 'product_interaction' as const,
        productId: fixture.product.id,
        interactionType: 'details_opened' as const,
        ...eventBase(fixture.publication.id),
      },
      {
        eventId: eventIds[4]!,
        eventType: 'category_selected' as const,
        categoryId: fixture.category.id,
        ...eventBase(fixture.publication.id),
      },
    ];

    await expect(
      service.ingest(
        {
          establishmentPublicId: fixture.tenant.establishment.publicId,
          sessionId: session.sessionId,
          events,
        },
        'ingest-ip',
      ),
    ).resolves.toEqual({
      results: eventIds.map((eventId) => ({ eventId, status: 'accepted' })),
    });

    const semanticDuplicate = await service.ingest(
      {
        establishmentPublicId: fixture.tenant.establishment.publicId,
        sessionId: session.sessionId,
        events: [
          {
            eventId: randomUUID(),
            eventType: 'product_impression',
            productId: fixture.product.id,
            intersectionRatio: 0.8,
            durationMs: 700,
            ...eventBase(fixture.publication.id),
          },
        ],
      },
      'ingest-ip',
    );
    expect(semanticDuplicate.results[0]).toMatchObject({ status: 'duplicate' });

    const conflict = await service.ingest(
      {
        establishmentPublicId: fixture.tenant.establishment.publicId,
        sessionId: session.sessionId,
        events: [
          {
            ...events[1]!,
            productId: randomUUID(),
          },
        ],
      },
      'ingest-ip',
    );
    expect(conflict.results[0]).toMatchObject({
      eventId: eventIds[1],
      status: 'rejected',
      code: 'ANALYTICS_IDEMPOTENCY_CONFLICT',
    });
    await expect(database.analyticsEvent.count()).resolves.toBe(5);
  });

  it('returns partial failures for invalid targets and qualification rules', async () => {
    const fixture = await createPublishedAnalyticsFixture('Partial');
    const service = new AnalyticsService(new AnalyticsRateLimitService());
    const session = await service.createOrReuseSession(
      { establishmentPublicId: fixture.tenant.establishment.publicId },
      'partial-ip',
    );
    const results = await service.ingest(
      {
        establishmentPublicId: fixture.tenant.establishment.publicId,
        sessionId: session.sessionId,
        events: [
          { eventId: randomUUID(), eventType: 'menu_opened', ...eventBase(fixture.publication.id) },
          {
            eventId: randomUUID(),
            eventType: 'product_impression',
            productId: fixture.product.id,
            intersectionRatio: 0.49,
            durationMs: 500,
            ...eventBase(fixture.publication.id),
          },
          {
            eventId: randomUUID(),
            eventType: 'product_viewed',
            productId: fixture.product.id,
            intersectionRatio: 0.7,
            durationMs: 1_999,
            ...eventBase(fixture.publication.id),
          },
          {
            eventId: randomUUID(),
            eventType: 'category_selected',
            categoryId: randomUUID(),
            ...eventBase(fixture.publication.id),
          },
        ],
      },
      'partial-ip',
    );

    expect(results.results).toEqual([
      expect.objectContaining({ status: 'accepted' }),
      expect.objectContaining({ status: 'rejected', code: 'ANALYTICS_IMPRESSION_RULE_NOT_MET' }),
      expect.objectContaining({
        status: 'rejected',
        code: 'ANALYTICS_QUALIFIED_VIEW_RULE_NOT_MET',
      }),
      expect.objectContaining({ status: 'rejected', code: 'ANALYTICS_CATEGORY_INVALID' }),
    ]);
    await expect(database.analyticsEvent.count()).resolves.toBe(1);
  });

  it('rejects cross-establishment publications and targets', async () => {
    const first = await createPublishedAnalyticsFixture('Isolation A');
    const second = await createPublishedAnalyticsFixture('Isolation B');
    const service = new AnalyticsService(new AnalyticsRateLimitService());
    const session = await service.createOrReuseSession(
      { establishmentPublicId: first.tenant.establishment.publicId },
      'isolation-ip',
    );

    const results = await service.ingest(
      {
        establishmentPublicId: first.tenant.establishment.publicId,
        sessionId: session.sessionId,
        events: [
          { eventId: randomUUID(), eventType: 'menu_opened', ...eventBase(second.publication.id) },
          {
            eventId: randomUUID(),
            eventType: 'product_interaction',
            productId: second.product.id,
            interactionType: 'details_opened',
            ...eventBase(first.publication.id),
          },
        ],
      },
      'isolation-ip',
    );

    expect(results.results).toEqual([
      expect.objectContaining({ status: 'rejected', code: 'ANALYTICS_PUBLICATION_INVALID' }),
      expect.objectContaining({ status: 'rejected', code: 'ANALYTICS_PRODUCT_INVALID' }),
    ]);
  });

  it('aggregates dashboard metrics with tenant, category and product filters', async () => {
    const fixture = await createPublishedAnalyticsFixture('Aggregates', {
      includeSecondProduct: true,
    });
    const other = await createPublishedAnalyticsFixture('Other aggregate tenant');
    const service = new AnalyticsService(new AnalyticsRateLimitService());
    const session = await service.createOrReuseSession(
      { establishmentPublicId: fixture.tenant.establishment.publicId },
      'aggregate-ip',
    );
    await service.ingest(
      {
        establishmentPublicId: fixture.tenant.establishment.publicId,
        sessionId: session.sessionId,
        events: [
          { eventId: randomUUID(), eventType: 'menu_opened', ...eventBase(fixture.publication.id) },
          {
            eventId: randomUUID(),
            eventType: 'product_impression',
            productId: fixture.product.id,
            intersectionRatio: 0.5,
            durationMs: 500,
            ...eventBase(fixture.publication.id),
          },
          {
            eventId: randomUUID(),
            eventType: 'product_viewed',
            productId: fixture.product.id,
            intersectionRatio: 0.7,
            durationMs: 2_000,
            ...eventBase(fixture.publication.id),
          },
          {
            eventId: randomUUID(),
            eventType: 'category_selected',
            categoryId: fixture.category.id,
            ...eventBase(fixture.publication.id),
          },
          {
            eventId: randomUUID(),
            eventType: 'product_impression',
            productId: fixture.secondProduct!.id,
            intersectionRatio: 0.5,
            durationMs: 500,
            ...eventBase(fixture.publication.id),
          },
          {
            eventId: randomUUID(),
            eventType: 'product_viewed',
            productId: fixture.secondProduct!.id,
            intersectionRatio: 0.7,
            durationMs: 2_000,
            ...eventBase(fixture.publication.id),
          },
          {
            eventId: randomUUID(),
            eventType: 'category_selected',
            categoryId: fixture.secondCategory!.id,
            ...eventBase(fixture.publication.id),
          },
        ],
      },
      'aggregate-ip',
    );
    const secondSession = await service.createOrReuseSession(
      { establishmentPublicId: fixture.tenant.establishment.publicId },
      'aggregate-ip-second',
    );
    await service.ingest(
      {
        establishmentPublicId: fixture.tenant.establishment.publicId,
        sessionId: secondSession.sessionId,
        events: [
          {
            eventId: randomUUID(),
            eventType: 'product_viewed',
            productId: fixture.secondProduct!.id,
            intersectionRatio: 0.7,
            durationMs: 2_000,
            ...eventBase(fixture.publication.id),
          },
          {
            eventId: randomUUID(),
            eventType: 'category_selected',
            categoryId: fixture.secondCategory!.id,
            ...eventBase(fixture.publication.id),
          },
        ],
      },
      'aggregate-ip-second',
    );

    const queryService = new AnalyticsQueryService();
    const scope = {
      organizationId: fixture.tenant.organization.id,
      establishmentId: fixture.tenant.establishment.id,
      from: new Date(Date.now() - 60 * 60 * 1000),
      to: new Date(Date.now() + 60 * 60 * 1000),
    };
    await expect(queryService.summary(scope)).resolves.toEqual({
      sessions: 2,
      menuAccesses: 1,
      impressions: 2,
      qualifiedViews: 3,
      interactions: 0,
      categoryViews: 3,
    });
    await expect(queryService.products(scope)).resolves.toEqual([
      {
        productId: fixture.secondProduct!.id,
        impressions: 1,
        qualifiedViews: 2,
        interactions: 0,
      },
      { productId: fixture.product.id, impressions: 1, qualifiedViews: 1, interactions: 0 },
    ]);
    await expect(queryService.categories(scope)).resolves.toEqual([
      { categoryId: fixture.secondCategory!.id, views: 2 },
      { categoryId: fixture.category.id, views: 1 },
    ]);
    await expect(
      queryService.summary({ ...scope, categoryId: fixture.secondCategory!.id }),
    ).resolves.toEqual({
      sessions: 2,
      menuAccesses: 1,
      impressions: 1,
      qualifiedViews: 2,
      interactions: 0,
      categoryViews: 2,
    });
    await expect(
      queryService.summary({ ...scope, productId: fixture.product.id }),
    ).resolves.toEqual({
      sessions: 2,
      menuAccesses: 1,
      impressions: 1,
      qualifiedViews: 1,
      interactions: 0,
      categoryViews: 0,
    });
    const daily = await queryService.daily({
      ...scope,
      from: new Date('2026-08-01T00:00:00.000Z'),
      to: new Date('2026-08-04T00:00:00.000Z'),
    });
    expect(daily).toHaveLength(3);
    expect(daily.every((day) => day.impressions === 0 && day.menuAccesses === 0)).toBe(true);
    await expect(
      queryService.summary({
        ...scope,
        organizationId: other.tenant.organization.id,
        establishmentId: other.tenant.establishment.id,
      }),
    ).resolves.toEqual({
      sessions: 0,
      menuAccesses: 0,
      impressions: 0,
      qualifiedViews: 0,
      interactions: 0,
      categoryViews: 0,
    });
  });

  it('enforces persisted rate limits without storing raw trackers', async () => {
    const rateLimit = new AnalyticsRateLimitService();
    await rateLimit.consume('analytics-test', 'private-ip', 1);
    await expect(rateLimit.consume('analytics-test', 'private-ip', 1)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ANALYTICS_RATE_LIMIT_EXCEEDED' }),
    });
    const bucket = await database.analyticsRateLimitBucket.findFirstOrThrow({
      where: { action: 'analytics-test' },
    });
    expect(bucket.trackerHash).not.toContain('private-ip');
  });

  it('cleans unreferenced operational rows while preserving event-linked sessions and events', async () => {
    const fixture = await createPublishedAnalyticsFixture('Retention');
    const analytics = new AnalyticsService(new AnalyticsRateLimitService());
    const linkedSession = await analytics.createOrReuseSession(
      { establishmentPublicId: fixture.tenant.establishment.publicId },
      'retention-ip',
    );
    await analytics.ingest(
      {
        establishmentPublicId: fixture.tenant.establishment.publicId,
        sessionId: linkedSession.sessionId,
        events: [
          { eventId: randomUUID(), eventType: 'menu_opened', ...eventBase(fixture.publication.id) },
        ],
      },
      'retention-ip',
    );

    const now = new Date();
    const old = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const oldLastSeen = new Date(old.getTime() - 60 * 60 * 1000);
    const unreferencedSession = await createAnalyticsSession(database, {
      organizationId: fixture.tenant.organization.id,
      establishmentId: fixture.tenant.establishment.id,
      firstSeenAt: oldLastSeen,
      lastSeenAt: oldLastSeen,
      expiresAt: old,
    });
    await database.analyticsSession.update({
      where: { id: linkedSession.sessionId },
      data: { lastSeenAt: oldLastSeen, expiresAt: old },
    });
    await database.analyticsRateLimitBucket.create({
      data: {
        action: 'analytics-retention-test',
        trackerHash: randomUUID().replaceAll('-', ''),
        windowStartedAt: old,
        count: 1,
        updatedAt: old,
      },
    });

    const result = await new AnalyticsRetentionService().cleanup(now);

    expect(result.sessionsDeleted).toBe(1);
    expect(result.rateLimitBucketsDeleted).toBeGreaterThanOrEqual(1);
    await expect(
      database.analyticsSession.findUnique({ where: { id: unreferencedSession.id } }),
    ).resolves.toBeNull();
    await expect(
      database.analyticsSession.findUnique({ where: { id: linkedSession.sessionId } }),
    ).resolves.not.toBeNull();
    await expect(
      database.analyticsEvent.count({ where: { sessionId: linkedSession.sessionId } }),
    ).resolves.toBe(1);
  });
});
