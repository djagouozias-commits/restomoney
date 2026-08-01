-- Migration 003: Menus Complets, Composants, Options
-- Requirements: 5.1, 5.2

-- =============================================
-- MENUS COMPLETS (combos / promotions)
-- =============================================
CREATE TABLE IF NOT EXISTS menus_complets (
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
-- COMPOSANTS d'un menu complet
-- =============================================
CREATE TABLE IF NOT EXISTS composants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_complet_id UUID NOT NULL REFERENCES menus_complets(id) ON DELETE CASCADE,
  nom             TEXT NOT NULL,
  a_choix         BOOLEAN DEFAULT FALSE,
  position        SMALLINT NOT NULL DEFAULT 1,
  UNIQUE (menu_complet_id, position)
);

-- =============================================
-- OPTIONS sélectionnables d'un composant à choix
-- =============================================
CREATE TABLE IF NOT EXISTS options (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composant_id UUID NOT NULL REFERENCES composants(id) ON DELETE CASCADE,
  nom          TEXT NOT NULL,
  position     SMALLINT NOT NULL DEFAULT 1,
  UNIQUE (composant_id, position)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_menus_actif ON menus_complets(actif);
CREATE INDEX IF NOT EXISTS idx_composants_menu ON composants(menu_complet_id);
CREATE INDEX IF NOT EXISTS idx_options_composant ON options(composant_id);
