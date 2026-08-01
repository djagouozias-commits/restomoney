-- =============================================
-- MIGRATION 010 — Table bons_reduction
-- =============================================
-- Requirement 4.1 : stocke id, structure_id, valeur_pct, emis_le,
--                   expire_le, utilise, commande_id_source
-- Requirement 4.6 : valeur_pct ∈ [1, 100]

CREATE TABLE IF NOT EXISTS bons_reduction (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id       UUID        NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  valeur_pct         INT         NOT NULL CHECK (valeur_pct BETWEEN 1 AND 100),
  emis_le            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expire_le          TIMESTAMPTZ NOT NULL,
  utilise            BOOLEAN     NOT NULL DEFAULT FALSE,
  commande_id_source UUID        REFERENCES commandes(id)
);

-- Index pour les lookups fréquents
CREATE INDEX IF NOT EXISTS idx_bons_structure ON bons_reduction(structure_id);
CREATE INDEX IF NOT EXISTS idx_bons_expire    ON bons_reduction(expire_le);
CREATE INDEX IF NOT EXISTS idx_bons_utilise   ON bons_reduction(utilise);
