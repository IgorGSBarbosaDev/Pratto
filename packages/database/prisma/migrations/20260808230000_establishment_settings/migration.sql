ALTER TABLE "establishments"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "phone" VARCHAR(30),
  ADD COLUMN "whatsapp" VARCHAR(30),
  ADD COLUMN "address" JSONB,
  ADD COLUMN "operating_hours" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "logo_key" VARCHAR(512),
  ADD COLUMN "logo_content_type" VARCHAR(100),
  ADD COLUMN "cover_image_key" VARCHAR(512),
  ADD COLUMN "cover_image_content_type" VARCHAR(100),
  ADD COLUMN "theme_settings" JSONB NOT NULL DEFAULT '{"mode":"LIGHT","primaryColor":"#166534"}'::jsonb;

ALTER TABLE "establishments"
  ADD CONSTRAINT "establishments_address_object_check"
    CHECK ("address" IS NULL OR jsonb_typeof("address") = 'object'),
  ADD CONSTRAINT "establishments_operating_hours_object_check"
    CHECK (jsonb_typeof("operating_hours") = 'object'),
  ADD CONSTRAINT "establishments_theme_settings_object_check"
    CHECK (jsonb_typeof("theme_settings") = 'object'),
  ADD CONSTRAINT "establishments_logo_reference_consistency_check"
    CHECK (("logo_key" IS NULL) = ("logo_content_type" IS NULL)),
  ADD CONSTRAINT "establishments_cover_reference_consistency_check"
    CHECK (("cover_image_key" IS NULL) = ("cover_image_content_type" IS NULL));
