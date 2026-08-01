-- Migration 013 : Variantes de prix par plat
-- Permet d'avoir plusieurs formules (Standard, Standard+saucisse, Star...) par plat

CREATE TABLE IF NOT EXISTS plat_variantes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plat_id    UUID NOT NULL REFERENCES plats(id) ON DELETE CASCADE,
  libelle    TEXT NOT NULL,
  prix       NUMERIC(10, 2) NOT NULL CHECK (prix > 0),
  position   SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (plat_id, position)
);

CREATE INDEX IF NOT EXISTS idx_plat_variantes_plat_id ON plat_variantes(plat_id);

-- Migrer les prix existants : créer une variante "Standard" pour chaque plat
INSERT INTO plat_variantes (plat_id, libelle, prix, position)
SELECT id, 'Standard', prix, 1
FROM plats
ON CONFLICT (plat_id, position) DO NOTHING;

-- Ajouter variante_id sur lignes_commande
ALTER TABLE lignes_commande ADD COLUMN IF NOT EXISTS variante_id UUID REFERENCES plat_variantes(id);
