-- Product media belongs to the same tenant and menu as its product.
CREATE TYPE "product_media_type" AS ENUM ('IMAGE', 'VIDEO');

CREATE UNIQUE INDEX "products_id_organization_id_menu_id_key"
  ON "products"("id", "organization_id", "menu_id");

CREATE TABLE "product_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "media_type" "product_media_type" NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_media_content_type_not_blank_check" CHECK (btrim("content_type") <> ''),
    CONSTRAINT "product_media_original_name_not_blank_check" CHECK (btrim("original_name") <> ''),
    CONSTRAINT "product_media_storage_key_not_blank_check" CHECK (btrim("storage_key") <> ''),
    CONSTRAINT "product_media_size_positive_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 52428800),
    CONSTRAINT "product_media_display_order_nonnegative_check" CHECK ("display_order" >= 0),
    CONSTRAINT "product_media_content_type_check" CHECK (
      ("media_type" = 'IMAGE' AND "content_type" IN ('image/jpeg', 'image/png', 'image/webp'))
      OR ("media_type" = 'VIDEO' AND "content_type" IN ('video/mp4', 'video/webm', 'video/quicktime'))
    )
);

CREATE UNIQUE INDEX "product_media_id_organization_id_key"
  ON "product_media"("id", "organization_id");
CREATE UNIQUE INDEX "product_media_storage_key_key"
  ON "product_media"("storage_key");
CREATE UNIQUE INDEX "product_media_product_primary_key"
  ON "product_media"("product_id")
  WHERE "is_primary" = true;
CREATE INDEX "product_media_org_menu_product_order_idx"
  ON "product_media"("organization_id", "menu_id", "product_id", "display_order");
CREATE INDEX "product_media_org_menu_product_primary_idx"
  ON "product_media"("organization_id", "menu_id", "product_id", "is_primary");

ALTER TABLE "product_media"
  ADD CONSTRAINT "product_media_product_id_organization_id_menu_id_fkey"
    FOREIGN KEY ("product_id", "organization_id", "menu_id")
    REFERENCES "products"("id", "organization_id", "menu_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
