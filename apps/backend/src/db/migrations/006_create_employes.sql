-- Migration 006 : Table des employés par structure
-- Un employé appartient à une structure et commande en son nom propre.
-- Son login est auto-généré : slug(structure) + numéro séquentiel (ex: boa1, boa2...)

CREATE TABLE IF NOT EXISTS employes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id  UUID        NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  login         TEXT        UNIQUE NOT NULL,   -- ex: boa1, boa2, boa3
  nom           TEXT,                          -- nom optionnel de l'employé
  password_hash TEXT        NOT NULL,
  actif         BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les lookups par structure
CREATE INDEX IF NOT EXISTS idx_employes_structure ON employes(structure_id);
CREATE INDEX IF NOT EXISTS idx_employes_login     ON employes(login);
