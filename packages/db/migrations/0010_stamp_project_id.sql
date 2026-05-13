ALTER TABLE company_stamps
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_stamps_project ON company_stamps(project_id);
