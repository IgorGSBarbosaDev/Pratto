CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "normalized_name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status" "lifecycle_status" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "categories_name_not_blank_check" CHECK (btrim("name") <> ''),
    CONSTRAINT "categories_normalized_name_not_blank_check" CHECK (btrim("normalized_name") <> ''),
    CONSTRAINT "categories_display_order_nonnegative_check" CHECK ("display_order" >= 0),
    CONSTRAINT "categories_archive_state_check" CHECK (
      ("archived_at" IS NULL AND "status" IN ('ACTIVE', 'INACTIVE'))
      OR ("archived_at" IS NOT NULL AND "status" = 'INACTIVE')
    )
);

CREATE UNIQUE INDEX "categories_id_organization_id_key"
  ON "categories"("id", "organization_id");
-- Prisma does not model partial unique indexes; keep this index in SQL and preserve it in future migrations.
CREATE UNIQUE INDEX "categories_menu_id_normalized_name_active_key"
  ON "categories"("menu_id", "normalized_name")
  WHERE "archived_at" IS NULL;
CREATE INDEX "categories_menu_id_normalized_name_idx"
  ON "categories"("menu_id", "normalized_name");
CREATE INDEX "categories_org_menu_archived_order_idx"
  ON "categories"("organization_id", "menu_id", "archived_at", "display_order");

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_menu_id_organization_id_fkey"
    FOREIGN KEY ("menu_id", "organization_id")
    REFERENCES "menus"("id", "organization_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
