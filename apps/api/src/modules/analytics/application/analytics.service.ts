import { createHash } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  AnalyticsEventResult,
  AnalyticsIngestResponse,
  AnalyticsSessionResponse,
} from '@pratto/contracts';
import { prisma, Prisma } from '@pratto/database';
import type {
  AnalyticsEventInput,
  AnalyticsIngestInput,
  AnalyticsSessionInput,
} from '@pratto/validation';
import { z } from 'zod';

import { StableHttpException } from '../../../common/http/stable-http.exception';

import { AnalyticsRateLimitService } from './analytics-rate-limit.service';

const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const EVENT_PAST_LIMIT_MS = 15 * 60 * 1000;
const EVENT_FUTURE_LIMIT_MS = 2 * 60 * 1000;

const analyticsSnapshotSchema = z.object({
  categories: z.array(z.object({ id: z.string() })),
  products: z.array(
    z.object({
      id: z.string(),
      categoryId: z.string(),
      availability: z.enum(['AVAILABLE', 'TEMPORARILY_UNAVAILABLE', 'HIDDEN']),
    }),
  ),
});

type AnalyticsSnapshot = z.infer<typeof analyticsSnapshotSchema>;
type SnapshotProduct = AnalyticsSnapshot['products'][number];

interface PublicationContext {
  id: string;
  menuId: string;
  categories: Set<string>;
  visibleCategoryIds: Set<string>;
  products: Map<string, SnapshotProduct>;
}

type AnalyticsErrorCode =
  'ANALYTICS_ESTABLISHMENT_NOT_FOUND' | 'ANALYTICS_SESSION_INVALID' | 'ANALYTICS_UNAVAILABLE';

export class AnalyticsServiceError extends Error {
  constructor(
    public readonly code: AnalyticsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AnalyticsServiceError';
  }
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(AnalyticsRateLimitService)
    private readonly rateLimit: AnalyticsRateLimitService,
  ) {}

  async createOrReuseSession(
    input: AnalyticsSessionInput,
    tracker: string,
  ): Promise<AnalyticsSessionResponse> {
    await this.rateLimit.consume('analytics-session-ip', tracker, 10);
    const establishment = await this.findEstablishment(input.establishmentPublicId);
    const now = new Date();

    if (input.sessionId) {
      const existing = await prisma.analyticsSession.findUnique({
        where: { id: input.sessionId },
      });
      if (
        existing &&
        (existing.establishmentId !== establishment.id ||
          existing.organizationId !== establishment.organizationId)
      ) {
        this.fail('ANALYTICS_SESSION_INVALID', 'A sessão anônima não pertence ao estabelecimento.');
      }
      if (existing && existing.expiresAt > now) {
        const expiresAt = this.sessionExpiry(now);
        const refreshed = await prisma.analyticsSession.update({
          where: { id: existing.id },
          data: { lastSeenAt: now, expiresAt },
        });
        return this.toSessionResponse(refreshed.id, refreshed.expiresAt);
      }
    }

    const expiresAt = this.sessionExpiry(now);
    const session = await prisma.analyticsSession.create({
      data: {
        organizationId: establishment.organizationId,
        establishmentId: establishment.id,
        firstSeenAt: now,
        lastSeenAt: now,
        expiresAt,
      },
    });
    return this.toSessionResponse(session.id, session.expiresAt);
  }

  async ingest(input: AnalyticsIngestInput, tracker: string): Promise<AnalyticsIngestResponse> {
    await this.rateLimit.consume('analytics-ingest-ip', tracker, 60);
    await this.rateLimit.consume(
      'analytics-events-session',
      input.sessionId,
      300,
      input.events.length,
    );

    const session = await prisma.analyticsSession.findUnique({
      where: { id: input.sessionId },
    });
    const now = new Date();
    if (!session || session.expiresAt <= now) {
      this.fail('ANALYTICS_SESSION_INVALID', 'A sessão anônima é inválida ou expirou.');
    }

    const establishment = await this.findEstablishment(input.establishmentPublicId);
    if (
      session.establishmentId !== establishment.id ||
      session.organizationId !== establishment.organizationId
    ) {
      this.fail('ANALYTICS_SESSION_INVALID', 'A sessão anônima não pertence ao estabelecimento.');
    }

    const publicationCache = new Map<string, PublicationContext | null>();
    const results: AnalyticsEventResult[] = [];
    for (const event of input.events) {
      results.push(
        await this.persistEvent({
          event,
          sessionId: session.id,
          organizationId: session.organizationId,
          establishmentId: session.establishmentId,
          publicationCache,
          now,
        }),
      );
    }

    await prisma.analyticsSession.update({
      where: { id: session.id },
      data: { lastSeenAt: now, expiresAt: this.sessionExpiry(now) },
    });
    return { results };
  }

  private async persistEvent(input: {
    event: AnalyticsEventInput;
    sessionId: string;
    organizationId: string;
    establishmentId: string;
    publicationCache: Map<string, PublicationContext | null>;
    now: Date;
  }): Promise<AnalyticsEventResult> {
    const { event } = input;
    const occurredAt = new Date(event.occurredAt);
    if (
      occurredAt.getTime() < input.now.getTime() - EVENT_PAST_LIMIT_MS ||
      occurredAt.getTime() > input.now.getTime() + EVENT_FUTURE_LIMIT_MS
    ) {
      return this.rejected(event.eventId, 'ANALYTICS_EVENT_TIME_OUT_OF_RANGE');
    }

    const payloadHash = this.hashPayload(event);
    const existing = await prisma.analyticsEvent.findUnique({
      where: { id: event.eventId },
      select: { payloadHash: true },
    });
    if (existing) {
      return existing.payloadHash === payloadHash
        ? { eventId: event.eventId, status: 'duplicate' }
        : this.rejected(event.eventId, 'ANALYTICS_IDEMPOTENCY_CONFLICT');
    }

    const publication = await this.getPublicationContext(
      event.publicationId,
      input.organizationId,
      input.establishmentId,
      input.publicationCache,
    );
    if (!publication) return this.rejected(event.eventId, 'ANALYTICS_PUBLICATION_INVALID');

    const product = 'productId' in event ? publication.products.get(event.productId) : undefined;
    if ('productId' in event && !product) {
      return this.rejected(event.eventId, 'ANALYTICS_PRODUCT_INVALID');
    }
    if (
      event.eventType === 'category_selected' &&
      !publication.visibleCategoryIds.has(event.categoryId)
    ) {
      return this.rejected(event.eventId, 'ANALYTICS_CATEGORY_INVALID');
    }
    if (event.eventType === 'product_impression') {
      if (event.intersectionRatio < 0.5 || event.durationMs < 500) {
        return this.rejected(event.eventId, 'ANALYTICS_IMPRESSION_RULE_NOT_MET');
      }
    }
    if (event.eventType === 'product_viewed') {
      if (event.intersectionRatio < 0.7 || event.durationMs < 2000) {
        return this.rejected(event.eventId, 'ANALYTICS_QUALIFIED_VIEW_RULE_NOT_MET');
      }
    }

    const categoryId =
      product?.categoryId ?? (event.eventType === 'category_selected' ? event.categoryId : null);
    const dedupeKey = this.createDedupeKey({
      event,
      sessionId: input.sessionId,
      publicationId: publication.id,
      categoryId,
    });
    try {
      await prisma.analyticsEvent.create({
        data: {
          id: event.eventId,
          organizationId: input.organizationId,
          establishmentId: input.establishmentId,
          menuId: publication.menuId,
          publicationId: publication.id,
          sessionId: input.sessionId,
          eventType: this.toDatabaseEventType(event.eventType),
          productId: product?.id,
          categoryId,
          interactionType: event.eventType === 'product_interaction' ? event.interactionType : null,
          contactType: event.eventType === 'contact_clicked' ? event.contactType : null,
          intersectionRatio:
            'intersectionRatio' in event ? new Prisma.Decimal(event.intersectionRatio) : null,
          durationMs: 'durationMs' in event ? event.durationMs : null,
          occurredAt,
          payloadHash,
          dedupeKey,
        },
      });
      return { eventId: event.eventId, status: 'accepted' };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { eventId: event.eventId, status: 'duplicate' };
      }
      throw new StableHttpException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'ANALYTICS_UNAVAILABLE',
        'Não foi possível registrar os eventos de analytics.',
      );
    }
  }

  private async getPublicationContext(
    publicationId: string,
    organizationId: string,
    establishmentId: string,
    cache: Map<string, PublicationContext | null>,
  ): Promise<PublicationContext | null> {
    if (cache.has(publicationId)) return cache.get(publicationId) ?? null;
    const publication = await prisma.menuPublication.findFirst({
      where: {
        id: publicationId,
        organizationId,
        menu: { establishmentId, organizationId },
      },
      select: { id: true, menuId: true, snapshot: true },
    });
    if (!publication) {
      cache.set(publicationId, null);
      return null;
    }
    const parsed = analyticsSnapshotSchema.safeParse(publication.snapshot);
    if (!parsed.success) {
      cache.set(publicationId, null);
      return null;
    }
    const categories = new Set(parsed.data.categories.map((category) => category.id));
    const products = new Map(
      parsed.data.products
        .filter(
          (product) => product.availability !== 'HIDDEN' && categories.has(product.categoryId),
        )
        .map((product) => [product.id, product]),
    );
    const context: PublicationContext = {
      id: publication.id,
      menuId: publication.menuId,
      categories,
      visibleCategoryIds: new Set([...products.values()].map((product) => product.categoryId)),
      products,
    };
    cache.set(publicationId, context);
    return context;
  }

  private async findEstablishment(publicId: string) {
    const establishment = await prisma.establishment.findFirst({
      where: { publicId, status: 'ACTIVE' },
      select: { id: true, organizationId: true },
    });
    if (!establishment) {
      this.fail('ANALYTICS_ESTABLISHMENT_NOT_FOUND', 'Estabelecimento não encontrado.');
    }
    return establishment;
  }

  private createDedupeKey(input: {
    event: AnalyticsEventInput;
    sessionId: string;
    publicationId: string;
    categoryId: string | null;
  }): string {
    if (
      input.event.eventType === 'product_interaction' ||
      input.event.eventType === 'contact_clicked'
    ) {
      return `event:${input.event.eventId}`;
    }
    const target =
      'productId' in input.event ? input.event.productId : (input.categoryId ?? 'menu');
    return [input.sessionId, input.publicationId, input.event.eventType, target].join(':');
  }

  private hashPayload(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private toDatabaseEventType(
    eventType: AnalyticsEventInput['eventType'],
  ):
    | 'MENU_OPENED'
    | 'PRODUCT_IMPRESSION'
    | 'PRODUCT_VIEWED'
    | 'PRODUCT_INTERACTION'
    | 'CATEGORY_SELECTED'
    | 'CONTACT_CLICKED' {
    const eventTypes = {
      menu_opened: 'MENU_OPENED',
      product_impression: 'PRODUCT_IMPRESSION',
      product_viewed: 'PRODUCT_VIEWED',
      product_interaction: 'PRODUCT_INTERACTION',
      category_selected: 'CATEGORY_SELECTED',
      contact_clicked: 'CONTACT_CLICKED',
    } as const;
    return eventTypes[eventType];
  }

  private toSessionResponse(sessionId: string, expiresAt: Date): AnalyticsSessionResponse {
    return { sessionId, expiresAt: expiresAt.toISOString() };
  }

  private sessionExpiry(now: Date): Date {
    return new Date(now.getTime() + SESSION_IDLE_TIMEOUT_MS);
  }

  private rejected(eventId: string, code: string): AnalyticsEventResult {
    return { eventId, status: 'rejected', code };
  }

  private fail(code: AnalyticsErrorCode, message: string): never {
    throw new AnalyticsServiceError(code, message);
  }
}

export function mapAnalyticsError(error: unknown): never {
  if (!(error instanceof AnalyticsServiceError)) throw error;
  const status =
    error.code === 'ANALYTICS_ESTABLISHMENT_NOT_FOUND' || error.code === 'ANALYTICS_SESSION_INVALID'
      ? HttpStatus.NOT_FOUND
      : HttpStatus.SERVICE_UNAVAILABLE;
  throw new StableHttpException(status, error.code, error.message);
}
