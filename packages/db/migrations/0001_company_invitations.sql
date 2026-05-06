-- Add invitation_status enum
CREATE TYPE "public"."invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'CANCELLED');

-- Add company_invitations table
CREATE TABLE "company_invitations" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id"  uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "email"       text NOT NULL,
  "role"        "member_role" NOT NULL DEFAULT 'MEMBER',
  "token"       uuid NOT NULL DEFAULT gen_random_uuid(),
  "status"      "invitation_status" NOT NULL DEFAULT 'PENDING',
  "invited_by"  text NOT NULL,
  "expires_at"  timestamp NOT NULL,
  "created_at"  timestamp DEFAULT now() NOT NULL
);

-- Indexes
CREATE UNIQUE INDEX "uq_company_invitations_token"   ON "company_invitations" ("token");
CREATE        INDEX "idx_company_invitations_company" ON "company_invitations" ("company_id");
CREATE        INDEX "idx_company_invitations_email"   ON "company_invitations" ("email");
