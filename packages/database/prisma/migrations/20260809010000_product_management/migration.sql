-- Editable products belong to one menu and one category in the same tenant.
CREATE TYPE "product_availability" AS ENUM ('AVAILABLE', 'TEMPORARILY_UNAVAILABLE', 'HIDDEN');

CREATE UNIQUE INDEX "categories_id_organization_id_menu_id_key"
  ON "categories"("id", "organization_id", "menu_id");

CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "promotional_price" DECIMAL(10,2),
    "ingredients" TEXT,
    "allergens" TEXT,
    "availability" "product_availability" NOT NULL DEFAULT 'AVAILABLE',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" "lifecycle_status" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_name_not_blank_check" CHECK (btrim("name") <> ''),
    CONSTRAINT "products_price_nonnegative_check" CHECK ("price" >= 0),
    CONSTRAINT "products_promotional_price_valid_check" CHECK (
      "promotional_price" IS NULL OR ("promotional_price" >= 0 AND "promotional_price" <= "price")
    ),
    CONSTRAINT "products_display_order_nonnegative_check" CHECK ("display_order" >= 0),
    CONSTRAINT "products_archive_state_check" CHECK (
      ("archived_at" IS NULL AND "status" IN ('ACTIVE', 'INACTIVE'))
      OR ("archived_at" IS NOT NULL AND "status" = 'INACTIVE')
    )
);

CREATE UNIQUE INDEX "products_id_organization_id_key"
  ON "products"("id", "organization_id");
CREATE INDEX "products_org_menu_archived_order_idx"
  ON "products"("organization_id", "menu_id", "archived_at", "display_order");
CREATE INDEX "products_org_menu_category_idx"
  ON "products"("organization_id", "menu_id", "category_id");

ALTER TABLE "products"
  ADD CONSTRAINT "products_menu_id_organization_id_fkey"
    FOREIGN KEY ("menu_id", "organization_id")
    REFERENCES "menus"("id", "organization_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "products_category_id_organization_id_menu_id_fkey"
    FOREIGN KEY ("category_id", "organization_id", "menu_id")
    REFERENCES "categories"("id", "organization_id", "menu_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
