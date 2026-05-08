ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "deposit_paid_at" timestamp;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "deposit_settlement_type" settlement_type;
