-- Authentication persistence is additive so existing tenant data remains intact.
ALTER TABLE "sessions"
  ADD COLUMN "active_membership_id" UUID,
  ADD COLUMN "absolute_expires_at" TIMESTAMPTZ(3);

UPDATE "sessions" SET "absolute_expires_at" = "expires_at";
ALTER TABLE "sessions" ALTER COLUMN "absolute_expires_at" SET NOT NULL;

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_absolute_expires_after_creation_check"
    CHECK ("absolute_expires_at" > "created_at"),
  ADD CONSTRAINT "sessions_idle_not_after_absolute_check"
    CHECK ("expires_at" <= "absolute_expires_at");

CREATE UNIQUE INDEX "memberships_id_user_id_key" ON "memberships"("id", "user_id");
CREATE INDEX "sessions_absolute_expires_at_idx" ON "sessions"("absolute_expires_at");
CREATE INDEX "sessions_active_membership_id_idx" ON "sessions"("active_membership_id");

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_membership_id_user_id_fkey"
  FOREIGN KEY ("active_membership_id", "user_id") REFERENCES "memberships"("id", "user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "password_credentials" (
  "user_id" UUID NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "password_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "password_credentials_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "password_credentials_password_hash_not_blank_check" CHECK (btrim("password_hash") <> ''),
  CONSTRAINT "password_credentials_changed_after_creation_check" CHECK ("password_changed_at" >= "created_at"),
  CONSTRAINT "password_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "password_reset_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "used_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_tokens_token_hash_not_blank_check" CHECK (btrim("token_hash") <> ''),
  CONSTRAINT "password_reset_tokens_expires_after_creation_check" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "password_reset_tokens_used_after_creation_check" CHECK ("used_at" IS NULL OR "used_at" >= "created_at"),
  CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "password_reset_tokens_user_id_key" ON "password_reset_tokens"("user_id");
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_expires_at_used_at_idx" ON "password_reset_tokens"("expires_at", "used_at");

CREATE TABLE "auth_rate_limit_buckets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "action" VARCHAR(40) NOT NULL,
  "tracker_hash" VARCHAR(128) NOT NULL,
  "window_started_at" TIMESTAMPTZ(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "blocked_until" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "auth_rate_limit_buckets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_rate_limit_buckets_action_not_blank_check" CHECK (btrim("action") <> ''),
  CONSTRAINT "auth_rate_limit_buckets_tracker_hash_not_blank_check" CHECK (btrim("tracker_hash") <> ''),
  CONSTRAINT "auth_rate_limit_buckets_count_positive_check" CHECK ("count" >= 0)
);

CREATE UNIQUE INDEX "auth_rate_limit_buckets_action_tracker_hash_key" ON "auth_rate_limit_buckets"("action", "tracker_hash");
CREATE INDEX "auth_rate_limit_buckets_blocked_until_idx" ON "auth_rate_limit_buckets"("blocked_until");

CREATE TABLE "authentication_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "session_id" UUID,
  "organization_id" UUID,
  "event_type" VARCHAR(60) NOT NULL,
  "outcome" VARCHAR(20) NOT NULL,
  "subject_hash" VARCHAR(128),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "authentication_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "authentication_events_event_type_not_blank_check" CHECK (btrim("event_type") <> ''),
  CONSTRAINT "authentication_events_outcome_not_blank_check" CHECK (btrim("outcome") <> ''),
  CONSTRAINT "authentication_events_subject_hash_not_blank_check" CHECK ("subject_hash" IS NULL OR btrim("subject_hash") <> ''),
  CONSTRAINT "authentication_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "authentication_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "authentication_events_user_id_created_at_idx" ON "authentication_events"("user_id", "created_at");
CREATE INDEX "authentication_events_event_type_created_at_idx" ON "authentication_events"("event_type", "created_at");
