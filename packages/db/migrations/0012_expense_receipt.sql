ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS receipt_url text;

ALTER TABLE stamp_sessions
  ALTER COLUMN invoice_id DROP NOT NULL;
