-- Table historique_sanctions
-- Journalise chaque sanction appliquée pour l'observabilité et l'audit (Requirement 6.3)
CREATE TABLE IF NOT EXISTS historique_sanctions (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id    UUID           NOT NULL REFERENCES commandes(id),
  structure_id   UUID           NOT NULL,
  minutes_retard INT            NOT NULL,
  niveau         INT,
  montant_final  NUMERIC(10,2),
  applique_le    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Index pour les filtres de l'API historique (par commande, structure, date)
CREATE INDEX IF NOT EXISTS idx_historique_commande_id  ON historique_sanctions(commande_id);
CREATE INDEX IF NOT EXISTS idx_historique_structure_id ON historique_sanctions(structure_id);
CREATE INDEX IF NOT EXISTS idx_historique_applique_le  ON historique_sanctions(applique_le);
