-- ENUM type pour le statut des tournées
DO $$ BEGIN
  CREATE TYPE statut_tournee AS ENUM ('planifiee', 'en_cours', 'terminee');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tournées de livraison
CREATE TABLE IF NOT EXISTS tournees (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creneau      TIME NOT NULL,
  date_tournee DATE NOT NULL,
  statut       statut_tournee DEFAULT 'planifiee',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (creneau, date_tournee)
);

-- Points d'arrêt d'une tournée (Structure dans l'ordre)
CREATE TABLE IF NOT EXISTS tournee_structures (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournee_id   UUID NOT NULL REFERENCES tournees(id) ON DELETE CASCADE,
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  ordre        INT NOT NULL,
  livre        BOOLEAN DEFAULT FALSE,
  livre_at     TIMESTAMPTZ,
  UNIQUE (tournee_id, structure_id)
);

-- Journal des rotations automatiques
CREATE TABLE IF NOT EXISTS rotation_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_jour   DATE NOT NULL UNIQUE,
  statut      TEXT NOT NULL CHECK (statut IN ('succes', 'echec')),
  message     TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournees_date ON tournees(date_tournee);
CREATE INDEX IF NOT EXISTS idx_tournees_creneau ON tournees(creneau);
CREATE INDEX IF NOT EXISTS idx_tournee_structures_tournee ON tournee_structures(tournee_id);
CREATE INDEX IF NOT EXISTS idx_rotation_logs_date ON rotation_logs(date_jour);
