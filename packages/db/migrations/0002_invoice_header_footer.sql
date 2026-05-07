ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "invoice_header_url" text;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "invoice_footer_url" text;
