-- Team invitations are additive. Existing owner memberships remain the source of authorization.
CREATE TYPE "membership_invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELED');

CREATE TABLE "membership_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "invited_by_user_id" UUID NOT NULL,
    "accepted_user_id" UUID,
    "email" VARCHAR(320) NOT NULL,
    "role" "membership_role" NOT NULL,
    "status" "membership_invitation_status" NOT NULL DEFAULT 'PENDING',
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "canceled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "membership_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "membership_invitations_email_normalized_check" CHECK ("email" = lower(btrim("email")) AND "email" <> ''),
    CONSTRAINT "membership_invitations_token_hash_not_blank_check" CHECK (btrim("token_hash") <> ''),
    CONSTRAINT "membership_invitations_expires_after_creation_check" CHECK ("expires_at" > "created_at")
);

CREATE UNIQUE INDEX "membership_invitations_token_hash_key"
  ON "membership_invitations"("token_hash");
CREATE UNIQUE INDEX "membership_invitations_pending_organization_email_key"
  ON "membership_invitations"("organization_id", "email")
  WHERE "status" = 'PENDING';
CREATE INDEX "membership_invitations_team_status_idx"
  ON "membership_invitations"("organization_id", "establishment_id", "status", "expires_at");
CREATE INDEX "membership_invitations_email_status_idx"
  ON "membership_invitations"("email", "status");

ALTER TABLE "membership_invitations"
  ADD CONSTRAINT "membership_invitations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "membership_invitations_establishment_id_organization_id_fkey"
    FOREIGN KEY ("establishment_id", "organization_id") REFERENCES "establishments"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "membership_invitations_invited_by_user_id_fkey"
    FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "membership_invitations_accepted_user_id_fkey"
    FOREIGN KEY ("accepted_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
