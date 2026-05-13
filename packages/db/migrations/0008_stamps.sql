CREATE TABLE IF NOT EXISTS company_stamps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label      text NOT NULL DEFAULT '',
  url        text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stamps_company ON company_stamps(company_id);
