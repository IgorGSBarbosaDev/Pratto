-- Keep editable menu records separate from immutable public versions.
CREATE TABLE "menu_publications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_by" UUID NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,

    CONSTRAINT "menu_publications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "menu_publications_version_positive_check" CHECK ("version" > 0),
    CONSTRAINT "menu_publications_snapshot_object_check" CHECK (jsonb_typeof("snapshot") = 'object'),
    CONSTRAINT "menu_publications_idempotency_key_not_blank_check" CHECK (btrim("idempotency_key") <> '')
);

ALTER TABLE "menus"
  ADD COLUMN "active_publication_id" UUID;

CREATE UNIQUE INDEX "menus_id_organization_id_key"
  ON "menus"("id", "organization_id");
CREATE UNIQUE INDEX "menus_active_publication_id_organization_id_key"
  ON "menus"("active_publication_id", "organization_id");
CREATE UNIQUE INDEX "menu_publications_id_organization_id_key"
  ON "menu_publications"("id", "organization_id");
CREATE UNIQUE INDEX "menu_publications_menu_id_version_key"
  ON "menu_publications"("menu_id", "version");
CREATE UNIQUE INDEX "menu_publications_menu_id_idempotency_key_key"
  ON "menu_publications"("menu_id", "idempotency_key");
CREATE INDEX "menu_publications_organization_id_menu_id_published_at_idx"
  ON "menu_publications"("organization_id", "menu_id", "published_at");
CREATE INDEX "menu_publications_organization_id_published_at_idx"
  ON "menu_publications"("organization_id", "published_at");

ALTER TABLE "menu_publications"
  ADD CONSTRAINT "menu_publications_menu_id_organization_id_fkey"
    FOREIGN KEY ("menu_id", "organization_id")
    REFERENCES "menus"("id", "organization_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "menu_publications_published_by_fkey"
    FOREIGN KEY ("published_by")
    REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "menu_publications_publisher_membership_fkey"
    FOREIGN KEY ("organization_id", "published_by")
    REFERENCES "memberships"("organization_id", "user_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "menus"
  ADD CONSTRAINT "menus_active_publication_id_organization_id_fkey"
    FOREIGN KEY ("active_publication_id", "organization_id")
    REFERENCES "menu_publications"("id", "organization_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_menu_publication_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'menu publication is immutable';
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "menu_publications_immutable_trigger"
BEFORE UPDATE OR DELETE ON "menu_publications"
FOR EACH ROW
EXECUTE FUNCTION prevent_menu_publication_mutation();

CREATE OR REPLACE FUNCTION validate_menu_active_publication()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."active_publication_id" IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM "menu_publications"
           WHERE "id" = NEW."active_publication_id"
             AND "organization_id" = NEW."organization_id"
             AND "menu_id" = NEW."id"
       ) THEN
        RAISE EXCEPTION 'active publication must belong to the same menu and organization';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "menus_active_publication_same_menu_trigger"
BEFORE INSERT OR UPDATE OF "active_publication_id", "organization_id" ON "menus"
FOR EACH ROW
EXECUTE FUNCTION validate_menu_active_publication();
