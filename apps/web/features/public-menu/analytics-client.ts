import type {
  AnalyticsEventInput,
  AnalyticsSessionResponse,
  AnalyticsTrackEvent,
} from '@pratto/contracts';

import { publicRequest } from '../auth/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const STORAGE_PREFIX = 'pratto_analytics_session:';
const FLUSH_INTERVAL_MS = 2_000;
const FLUSH_THRESHOLD = 10;
const CLIENT_BATCH_SIZE = 20;
const MAX_QUEUE_SIZE = 100;

interface SessionStorageValue {
  sessionId: string;
  expiresAt: string;
}

export interface PublicAnalyticsContext {
  establishmentPublicId: string;
  publicationId: string;
}

export class PublicMenuAnalyticsClient {
  private context: PublicAnalyticsContext | null = null;
  private session: SessionStorageValue | null = null;
  private sessionPromise: Promise<void> | null = null;
  private queue: AnalyticsEventInput[] = [];
  private flushPromise: Promise<void> | null = null;
  private intervalId: number | null = null;
  private pagehideHandler: (() => void) | null = null;

  start(context: PublicAnalyticsContext): void {
    const changedEstablishment =
      this.context?.establishmentPublicId !== context.establishmentPublicId;
    this.context = context;
    if (changedEstablishment) this.session = this.readStoredSession(context.establishmentPublicId);
    if (!this.intervalId && typeof window !== 'undefined') {
      this.intervalId = window.setInterval(() => {
        void this.flush();
      }, FLUSH_INTERVAL_MS);
      this.pagehideHandler = () => {
        void this.flush(true);
      };
      window.addEventListener('pagehide', this.pagehideHandler);
    }
    void this.ensureSession();
  }

  track(event: AnalyticsTrackEvent): void {
    const context = this.context;
    if (!context) return;
    this.queue.push({
      ...event,
      eventId: createEventId(),
      publicationId: context.publicationId,
      occurredAt: new Date().toISOString(),
    } as AnalyticsEventInput);
    if (this.queue.length > MAX_QUEUE_SIZE)
      this.queue.splice(0, this.queue.length - MAX_QUEUE_SIZE);
    if (this.queue.length >= FLUSH_THRESHOLD) void this.flush();
  }

  stop(): void {
    if (typeof window !== 'undefined') {
      if (this.intervalId) window.clearInterval(this.intervalId);
      if (this.pagehideHandler) window.removeEventListener('pagehide', this.pagehideHandler);
    }
    this.intervalId = null;
    this.pagehideHandler = null;
    void this.flush(true);
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionPromise) return this.sessionPromise;
    const context = this.context;
    if (!context) return;
    if (this.session && Date.parse(this.session.expiresAt) > Date.now()) return;

    this.sessionPromise = publicRequest<AnalyticsSessionResponse>('/public/analytics/sessions', {
      method: 'POST',
      body: JSON.stringify({
        establishmentPublicId: context.establishmentPublicId,
        ...(this.session ? { sessionId: this.session.sessionId } : {}),
      }),
    })
      .then((session) => {
        this.session = session;
        this.writeStoredSession(context.establishmentPublicId, session);
      })
      .catch(() => {
        this.session = null;
      })
      .finally(() => {
        this.sessionPromise = null;
      });
    return this.sessionPromise;
  }

  private async flush(useBeacon = false): Promise<void> {
    if (this.flushPromise || this.queue.length === 0 || !this.context) return;
    this.flushPromise = this.flushInternal(useBeacon).finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  private async flushInternal(useBeacon: boolean): Promise<void> {
    await this.ensureSession();
    const context = this.context;
    const session = this.session;
    if (!context || !session || this.queue.length === 0) return;

    const batch = this.queue.splice(0, CLIENT_BATCH_SIZE);
    const body = JSON.stringify({
      establishmentPublicId: context.establishmentPublicId,
      sessionId: session.sessionId,
      events: batch,
    });
    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const accepted = navigator.sendBeacon(
        `${API_URL}/public/analytics/events`,
        new Blob([body], { type: 'application/json' }),
      );
      if (accepted) return;
    }

    try {
      const response = await fetch(`${API_URL}/public/analytics/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        keepalive: true,
        body,
      });
      if (!response.ok) throw new Error('analytics ingestion failed');
    } catch {
      this.requeueBatch(batch);
    }
  }

  private requeueBatch(events: AnalyticsEventInput[]): void {
    if (events.length === 0) return;
    this.queue = [...events, ...this.queue].slice(-MAX_QUEUE_SIZE);
  }

  private readStoredSession(establishmentPublicId: string): SessionStorageValue | null {
    if (typeof window === 'undefined') return null;
    try {
      const value = window.localStorage.getItem(`${STORAGE_PREFIX}${establishmentPublicId}`);
      if (!value) return null;
      const parsed = JSON.parse(value) as Partial<SessionStorageValue>;
      if (typeof parsed.sessionId !== 'string' || typeof parsed.expiresAt !== 'string') return null;
      return parsed as SessionStorageValue;
    } catch {
      return null;
    }
  }

  private writeStoredSession(establishmentPublicId: string, session: SessionStorageValue): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        `${STORAGE_PREFIX}${establishmentPublicId}`,
        JSON.stringify(session),
      );
    } catch {
      // Private browsing or a disabled storage should not affect the public menu.
    }
  }
}

function createEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
