import { z } from 'zod';

import { categoryIdSchema, productIdSchema } from './catalog';
import { publicIdSchema } from './common';

const analyticsEventIdSchema = z.string().uuid();
const analyticsPublicationIdSchema = z.string().uuid();
const analyticsSessionIdSchema = z.string().uuid();
const analyticsOccurredAtSchema = z.string().datetime({ offset: true });
const analyticsBaseSchema = z.object({
  eventId: analyticsEventIdSchema,
  publicationId: analyticsPublicationIdSchema,
  occurredAt: analyticsOccurredAtSchema,
});

const analyticsMenuOpenedSchema = analyticsBaseSchema
  .extend({ eventType: z.literal('menu_opened') })
  .strict();

const analyticsProductObservationSchema = analyticsBaseSchema
  .extend({
    eventType: z.enum(['product_impression', 'product_viewed']),
    productId: productIdSchema,
    intersectionRatio: z.number().min(0).max(1),
    durationMs: z.number().int().min(0).max(120_000),
  })
  .strict();

const analyticsProductInteractionSchema = analyticsBaseSchema
  .extend({
    eventType: z.literal('product_interaction'),
    productId: productIdSchema,
    interactionType: z.enum(['details_opened', 'media_changed', 'video_sound_toggled']),
  })
  .strict();

const analyticsCategorySelectedSchema = analyticsBaseSchema
  .extend({
    eventType: z.literal('category_selected'),
    categoryId: categoryIdSchema,
  })
  .strict();

const analyticsContactClickedSchema = analyticsBaseSchema
  .extend({
    eventType: z.literal('contact_clicked'),
    contactType: z.enum(['phone', 'whatsapp']),
  })
  .strict();

export const analyticsEventSchema = z.discriminatedUnion('eventType', [
  analyticsMenuOpenedSchema,
  analyticsProductObservationSchema,
  analyticsProductInteractionSchema,
  analyticsCategorySelectedSchema,
  analyticsContactClickedSchema,
]);

export const analyticsSessionSchema = z
  .object({
    establishmentPublicId: publicIdSchema,
    sessionId: analyticsSessionIdSchema.optional(),
  })
  .strict();

export const analyticsIngestSchema = z
  .object({
    establishmentPublicId: publicIdSchema,
    sessionId: analyticsSessionIdSchema,
    events: z.array(analyticsEventSchema).min(1).max(50),
  })
  .strict();

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
export type AnalyticsSessionInput = z.infer<typeof analyticsSessionSchema>;
export type AnalyticsIngestInput = z.infer<typeof analyticsIngestSchema>;

const analyticsDashboardDateSchema = z.string().datetime({ offset: true });

export const analyticsDashboardQuerySchema = z
  .object({
    from: analyticsDashboardDateSchema,
    to: analyticsDashboardDateSchema,
    categoryId: categoryIdSchema.optional(),
    productId: productIdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const from = new Date(value.from);
    const to = new Date(value.to);
    const durationMs = to.getTime() - from.getTime();

    if (durationMs <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: 'O fim do período deve ser posterior ao início.',
      });
    }
    if (durationMs > 366 * 24 * 60 * 60 * 1000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: 'O período não pode ultrapassar 366 dias.',
      });
    }
  });

export type AnalyticsDashboardQueryInput = z.infer<typeof analyticsDashboardQuerySchema>;
