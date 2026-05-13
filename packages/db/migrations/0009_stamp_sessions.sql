CREATE TABLE IF NOT EXISTS stamp_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL,
  invoice_id  uuid NOT NULL,
  status      text NOT NULL DEFAULT 'waiting',
  stamp_url   text,
  expires_at  timestamp NOT NULL,
  created_at  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stamp_sessions_expires ON stamp_sessions(expires_at);
