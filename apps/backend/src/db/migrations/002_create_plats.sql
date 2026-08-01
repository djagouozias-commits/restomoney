-- =============================================
-- PLATS
-- =============================================
CREATE TABLE IF NOT EXISTS plats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  prix        NUMERIC(10, 2) NOT NULL,
  actif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PLANNING HEBDOMADAIRE (0=lundi, 6=dimanche)
-- =============================================
CREATE TABLE IF NOT EXISTS planning_hebdomadaire (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jour_semaine SMALLINT NOT NULL CHECK (jour_semaine BETWEEN 0 AND 6),
  plat_id      UUID NOT NULL REFERENCES plats(id) ON DELETE CASCADE,
  position     SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 3),
  UNIQUE (jour_semaine, position)
);

-- =============================================
-- SURCHARGES PONCTUELLES (par date précise)
-- =============================================
CREATE TABLE IF NOT EXISTS surcharges_jour (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_jour DATE NOT NULL,
  plat_id   UUID NOT NULL REFERENCES plats(id) ON DELETE CASCADE,
  position  SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 3),
  UNIQUE (date_jour, position)
);

-- =============================================
-- PLATS DU JOUR (état courant actif)
-- =============================================
CREATE TABLE IF NOT EXISTS plats_du_jour (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_jour DATE NOT NULL,
  plat_id   UUID NOT NULL REFERENCES plats(id),
  position  SMALLINT NOT NULL,
  actif     BOOLEAN DEFAULT TRUE,
  UNIQUE (date_jour, position)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_plats_actif ON plats(actif);
CREATE INDEX IF NOT EXISTS idx_plats_du_jour_date ON plats_du_jour(date_jour, actif);
