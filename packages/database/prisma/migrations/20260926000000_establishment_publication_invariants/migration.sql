-- Resolve any legacy duplicate active menus deterministically before enforcing one public menu.
WITH "ranked_active_menus" AS (
  SELECT
    m."id",
    ROW_NUMBER() OVER (
      PARTITION BY m."establishment_id"
      ORDER BY p."published_at" DESC, p."id" DESC
    ) AS "position"
  FROM "menus" AS m
  INNER JOIN "menu_publications" AS p
    ON p."id" = m."active_publication_id"
   AND p."organization_id" = m."organization_id"
   AND p."menu_id" = m."id"
)
UPDATE "menus" AS m
SET "active_publication_id" = NULL,
    "status" = 'DRAFT'
FROM "ranked_active_menus" AS ranked
WHERE ranked."id" = m."id"
  AND ranked."position" > 1;

CREATE UNIQUE INDEX "menus_one_active_publication_per_establishment_key"
  ON "menus"("establishment_id")
  WHERE "active_publication_id" IS NOT NULL;

ALTER TABLE "establishments"
  ADD COLUMN "time_zone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo';
