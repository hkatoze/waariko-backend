ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2) NOT NULL DEFAULT 0;
