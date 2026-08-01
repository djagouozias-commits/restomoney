-- Migration 018 : Signalements retard avec photo
-- Permet à un employé de signaler la remise d'un repas en retard
-- via une photo horodatée. L'heure de prise de photo est utilisée
-- pour calculer le retard réel et appliquer la sanction.

CREATE TABLE IF NOT EXISTS signalements_retard (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id     UUID        NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  structure_id    UUID        NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  employe_id      UUID        REFERENCES employes(id) ON DELETE SET NULL,
  photo_url       TEXT        NOT NULL,           -- chemin vers la photo uploadée
  heure_signalement TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- heure réelle de remise
  retard_minutes  INTEGER,                        -- calculé automatiquement
  niveau_sanction INTEGER,                        -- niveau appliqué (1-4)
  reduction_pct   NUMERIC,                        -- % de réduction appliqué
  bon_emis        BOOLEAN     DEFAULT FALSE,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signalements_commande ON signalements_retard(commande_id);
CREATE INDEX IF NOT EXISTS idx_signalements_structure ON signalements_retard(structure_id);
CREATE INDEX IF NOT EXISTS idx_signalements_date ON signalements_retard(heure_signalement DESC);
