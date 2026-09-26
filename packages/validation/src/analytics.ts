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

const analyticsDashboardDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data no formato AAAA-MM-DD.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Informe uma data válida.');

export const analyticsDashboardQuerySchema = z
  .object({
    fromDate: analyticsDashboardDateSchema,
    toDate: analyticsDashboardDateSchema,
    categoryId: categoryIdSchema.optional(),
    productId: productIdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const from = new Date(`${value.fromDate}T00:00:00.000Z`);
    const to = new Date(`${value.toDate}T00:00:00.000Z`);
    const durationDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000) + 1;

    if (durationDays <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toDate'],
        message: 'O fim do período deve ser posterior ao início.',
      });
    }
    if (durationDays > 366) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toDate'],
        message: 'O período não pode ultrapassar 366 dias.',
      });
    }
  });

export type AnalyticsDashboardQueryInput = z.infer<typeof analyticsDashboardQuerySchema>;
