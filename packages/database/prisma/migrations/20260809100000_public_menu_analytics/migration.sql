-- Public analytics is anonymous, append-only event data scoped to the published menu context.
CREATE TYPE "analytics_event_type" AS ENUM (
  'MENU_OPENED',
  'PRODUCT_IMPRESSION',
  'PRODUCT_VIEWED',
  'PRODUCT_INTERACTION',
  'CATEGORY_SELECTED'
);

CREATE UNIQUE INDEX "menus_id_organization_id_establishment_id_key"
  ON "menus"("id", "organization_id", "establishment_id");

CREATE UNIQUE INDEX "menu_publications_id_organization_id_menu_id_key"
  ON "menu_publications"("id", "organization_id", "menu_id");

CREATE TABLE "analytics_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "first_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "analytics_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "analytics_sessions_time_check" CHECK (
      "first_seen_at" <= "last_seen_at" AND "expires_at" > "last_seen_at"
    )
);

CREATE UNIQUE INDEX "analytics_sessions_id_organization_id_establishment_id_key"
  ON "analytics_sessions"("id", "organization_id", "establishment_id");
CREATE INDEX "analytics_sessions_org_establishment_last_seen_idx"
  ON "analytics_sessions"("organization_id", "establishment_id", "last_seen_at");
CREATE INDEX "analytics_sessions_expires_at_idx"
  ON "analytics_sessions"("expires_at");

CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "event_type" "analytics_event_type" NOT NULL,
    "product_id" UUID,
    "category_id" UUID,
    "interaction_type" VARCHAR(40),
    "intersection_ratio" DECIMAL(4,3),
    "duration_ms" INTEGER,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload_hash" VARCHAR(64) NOT NULL,
    "dedupe_key" VARCHAR(512) NOT NULL,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "analytics_events_payload_hash_not_blank_check" CHECK (btrim("payload_hash") <> ''),
    CONSTRAINT "analytics_events_dedupe_key_not_blank_check" CHECK (btrim("dedupe_key") <> ''),
    CONSTRAINT "analytics_events_ratio_check" CHECK (
      "intersection_ratio" IS NULL OR ("intersection_ratio" >= 0 AND "intersection_ratio" <= 1)
    ),
    CONSTRAINT "analytics_events_duration_check" CHECK (
      "duration_ms" IS NULL OR ("duration_ms" >= 0 AND "duration_ms" <= 120000)
    ),
    CONSTRAINT "analytics_events_shape_check" CHECK (
      ("event_type" = 'MENU_OPENED'
        AND "product_id" IS NULL AND "category_id" IS NULL AND "interaction_type" IS NULL
        AND "intersection_ratio" IS NULL AND "duration_ms" IS NULL)
      OR ("event_type" = 'PRODUCT_IMPRESSION'
        AND "product_id" IS NOT NULL AND "category_id" IS NOT NULL AND "interaction_type" IS NULL
        AND "intersection_ratio" >= 0.5 AND "duration_ms" >= 500)
      OR ("event_type" = 'PRODUCT_VIEWED'
        AND "product_id" IS NOT NULL AND "category_id" IS NOT NULL AND "interaction_type" IS NULL
        AND "intersection_ratio" >= 0.7 AND "duration_ms" >= 2000)
      OR ("event_type" = 'PRODUCT_INTERACTION'
        AND "product_id" IS NOT NULL AND "category_id" IS NOT NULL
        AND "interaction_type" IN ('details_opened', 'media_changed', 'video_sound_toggled')
        AND "intersection_ratio" IS NULL AND "duration_ms" IS NULL)
      OR ("event_type" = 'CATEGORY_SELECTED'
        AND "product_id" IS NULL AND "category_id" IS NOT NULL AND "interaction_type" IS NULL
        AND "intersection_ratio" IS NULL AND "duration_ms" IS NULL)
    )
);

CREATE UNIQUE INDEX "analytics_events_dedupe_key_key"
  ON "analytics_events"("dedupe_key");
CREATE INDEX "analytics_events_org_establishment_occurred_idx"
  ON "analytics_events"("organization_id", "establishment_id", "occurred_at");
CREATE INDEX "analytics_events_publication_type_occurred_idx"
  ON "analytics_events"("organization_id", "publication_id", "event_type", "occurred_at");
CREATE INDEX "analytics_events_menu_type_occurred_idx"
  ON "analytics_events"("organization_id", "menu_id", "event_type", "occurred_at");
CREATE INDEX "analytics_events_product_type_occurred_idx"
  ON "analytics_events"("organization_id", "product_id", "event_type", "occurred_at");
CREATE INDEX "analytics_events_category_type_occurred_idx"
  ON "analytics_events"("organization_id", "category_id", "event_type", "occurred_at");
CREATE INDEX "analytics_events_session_occurred_idx"
  ON "analytics_events"("organization_id", "session_id", "occurred_at");

CREATE TABLE "analytics_rate_limit_buckets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action" VARCHAR(64) NOT NULL,
    "tracker_hash" VARCHAR(128) NOT NULL,
    "window_started_at" TIMESTAMPTZ(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "blocked_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "analytics_rate_limit_buckets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "analytics_rate_limit_buckets_count_check" CHECK ("count" >= 0)
);

CREATE UNIQUE INDEX "analytics_rate_limit_buckets_action_tracker_hash_key"
  ON "analytics_rate_limit_buckets"("action", "tracker_hash");
CREATE INDEX "analytics_rate_limit_buckets_blocked_until_idx"
  ON "analytics_rate_limit_buckets"("blocked_until");

ALTER TABLE "analytics_sessions"
  ADD CONSTRAINT "analytics_sessions_establishment_id_organization_id_fkey"
    FOREIGN KEY ("establishment_id", "organization_id")
    REFERENCES "establishments"("id", "organization_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "analytics_events"
  ADD CONSTRAINT "analytics_events_establishment_id_organization_id_fkey"
    FOREIGN KEY ("establishment_id", "organization_id")
    REFERENCES "establishments"("id", "organization_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "analytics_events_menu_id_organization_id_establishment_id_fkey"
    FOREIGN KEY ("menu_id", "organization_id", "establishment_id")
    REFERENCES "menus"("id", "organization_id", "establishment_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "analytics_events_publication_id_organization_id_menu_id_fkey"
    FOREIGN KEY ("publication_id", "organization_id", "menu_id")
    REFERENCES "menu_publications"("id", "organization_id", "menu_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "analytics_events_session_id_organization_id_establishment_id_fkey"
    FOREIGN KEY ("session_id", "organization_id", "establishment_id")
    REFERENCES "analytics_sessions"("id", "organization_id", "establishment_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "analytics_events_product_id_organization_id_menu_id_fkey"
    FOREIGN KEY ("product_id", "organization_id", "menu_id")
    REFERENCES "products"("id", "organization_id", "menu_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "analytics_events_category_id_organization_id_menu_id_fkey"
    FOREIGN KEY ("category_id", "organization_id", "menu_id")
    REFERENCES "categories"("id", "organization_id", "menu_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
