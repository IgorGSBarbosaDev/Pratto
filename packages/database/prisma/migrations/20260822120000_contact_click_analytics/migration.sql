ALTER TYPE "analytics_event_type" ADD VALUE 'CONTACT_CLICKED';

ALTER TABLE "analytics_events"
  ADD COLUMN "contact_type" VARCHAR(20);

ALTER TABLE "analytics_events"
  ADD CONSTRAINT "analytics_events_contact_type_check"
    CHECK ("contact_type" IS NULL OR "contact_type" IN ('phone', 'whatsapp'));

ALTER TABLE "analytics_events"
  DROP CONSTRAINT "analytics_events_shape_check";

ALTER TABLE "analytics_events"
  ADD CONSTRAINT "analytics_events_shape_check" CHECK (
    ("event_type" = 'MENU_OPENED'
      AND "product_id" IS NULL AND "category_id" IS NULL AND "interaction_type" IS NULL
      AND "contact_type" IS NULL
      AND "intersection_ratio" IS NULL AND "duration_ms" IS NULL)
    OR ("event_type" = 'PRODUCT_IMPRESSION'
      AND "product_id" IS NOT NULL AND "category_id" IS NOT NULL AND "interaction_type" IS NULL
      AND "contact_type" IS NULL
      AND "intersection_ratio" >= 0.5 AND "duration_ms" >= 500)
    OR ("event_type" = 'PRODUCT_VIEWED'
      AND "product_id" IS NOT NULL AND "category_id" IS NOT NULL AND "interaction_type" IS NULL
      AND "contact_type" IS NULL
      AND "intersection_ratio" >= 0.7 AND "duration_ms" >= 2000)
    OR ("event_type" = 'PRODUCT_INTERACTION'
      AND "product_id" IS NOT NULL AND "category_id" IS NOT NULL
      AND "interaction_type" IN ('details_opened', 'media_changed', 'video_sound_toggled')
      AND "contact_type" IS NULL
      AND "intersection_ratio" IS NULL AND "duration_ms" IS NULL)
    OR ("event_type" = 'CATEGORY_SELECTED'
      AND "product_id" IS NULL AND "category_id" IS NOT NULL AND "interaction_type" IS NULL
      AND "contact_type" IS NULL
      AND "intersection_ratio" IS NULL AND "duration_ms" IS NULL)
    OR ("event_type"::text = 'CONTACT_CLICKED'
      AND "product_id" IS NULL AND "category_id" IS NULL AND "interaction_type" IS NULL
      AND "contact_type" IN ('phone', 'whatsapp')
      AND "intersection_ratio" IS NULL AND "duration_ms" IS NULL)
  );
