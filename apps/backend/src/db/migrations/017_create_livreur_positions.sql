-- Migration 017 : Table des positions GPS des livreurs
-- Historique des positions pour replay + dernière position connue

CREATE TABLE IF NOT EXISTS livreur_positions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  livreur_id  UUID        NOT NULL REFERENCES livreurs(id) ON DELETE CASCADE,
  mission_id  UUID        REFERENCES missions(id) ON DELETE SET NULL,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  accuracy    DOUBLE PRECISION,            -- précision GPS en mètres
  heading     DOUBLE PRECISION,            -- cap (degrés)
  speed       DOUBLE PRECISION,            -- vitesse m/s
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour récupérer rapidement la dernière position d'un livreur
CREATE INDEX IF NOT EXISTS idx_livreur_positions_livreur_id ON livreur_positions(livreur_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_livreur_positions_mission_id ON livreur_positions(mission_id);

-- Vue : dernière position connue de chaque livreur actif
CREATE OR REPLACE VIEW last_livreur_positions AS
SELECT DISTINCT ON (lp.livreur_id)
  lp.livreur_id,
  l.nom        AS livreur_nom,
  lp.mission_id,
  lp.latitude,
  lp.longitude,
  lp.accuracy,
  lp.heading,
  lp.speed,
  lp.recorded_at
FROM livreur_positions lp
JOIN livreurs l ON l.id = lp.livreur_id
WHERE l.actif = true
ORDER BY lp.livreur_id, lp.recorded_at DESC;
