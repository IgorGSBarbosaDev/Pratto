export type AnalyticsEventType =
  | 'menu_opened'
  | 'product_impression'
  | 'product_viewed'
  | 'product_interaction'
  | 'category_selected';

export type AnalyticsInteractionType = 'details_opened' | 'media_changed' | 'video_sound_toggled';

export interface AnalyticsSessionResponse {
  sessionId: string;
  expiresAt: string;
}

export interface AnalyticsEventBase {
  eventId: string;
  publicationId: string;
  occurredAt: string;
}

export interface AnalyticsMenuOpenedEvent extends AnalyticsEventBase {
  eventType: 'menu_opened';
}

export interface AnalyticsProductObservationEvent extends AnalyticsEventBase {
  eventType: 'product_impression' | 'product_viewed';
  productId: string;
  intersectionRatio: number;
  durationMs: number;
}

export interface AnalyticsProductInteractionEvent extends AnalyticsEventBase {
  eventType: 'product_interaction';
  productId: string;
  interactionType: AnalyticsInteractionType;
}

export interface AnalyticsCategorySelectedEvent extends AnalyticsEventBase {
  eventType: 'category_selected';
  categoryId: string;
}

export type AnalyticsEventInput =
  | AnalyticsMenuOpenedEvent
  | AnalyticsProductObservationEvent
  | AnalyticsProductInteractionEvent
  | AnalyticsCategorySelectedEvent;

export type AnalyticsTrackEvent =
  | Omit<AnalyticsMenuOpenedEvent, 'eventId' | 'occurredAt' | 'publicationId'>
  | Omit<AnalyticsProductObservationEvent, 'eventId' | 'occurredAt' | 'publicationId'>
  | Omit<AnalyticsProductInteractionEvent, 'eventId' | 'occurredAt' | 'publicationId'>
  | Omit<AnalyticsCategorySelectedEvent, 'eventId' | 'occurredAt' | 'publicationId'>;

export interface AnalyticsIngestRequest {
  establishmentPublicId: string;
  sessionId: string;
  events: AnalyticsEventInput[];
}

export type AnalyticsEventResultStatus = 'accepted' | 'duplicate' | 'rejected';

export interface AnalyticsEventResult {
  eventId: string;
  status: AnalyticsEventResultStatus;
  code?: string;
}

export interface AnalyticsIngestResponse {
  results: AnalyticsEventResult[];
}

export interface AnalyticsSummary {
  sessions: number;
  impressions: number;
  qualifiedViews: number;
  interactions: number;
  categoryViews: number;
}

export interface AnalyticsDailyMetric extends AnalyticsSummary {
  day: string;
}

export interface AnalyticsProductMetric {
  productId: string;
  impressions: number;
  qualifiedViews: number;
  interactions: number;
}

export interface AnalyticsCategoryMetric {
  categoryId: string;
  views: number;
}
