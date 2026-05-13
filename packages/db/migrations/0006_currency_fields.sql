-- Devise par défaut au niveau de l'entreprise
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'FCFA';

-- Devise spécifique au projet (NULL = hérite de l'entreprise)
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "currency" text;
