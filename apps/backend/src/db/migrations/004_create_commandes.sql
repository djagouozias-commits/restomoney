-- ENUM statut_commande
DO $$ BEGIN
  CREATE TYPE statut_commande AS ENUM (
    'en_attente', 'en_preparation', 'en_livraison', 'livre', 'en_retard'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Commandes
CREATE TABLE IF NOT EXISTS commandes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id      UUID        NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  creneau           TIME        NOT NULL,
  date_commande     DATE        NOT NULL DEFAULT CURRENT_DATE,
  statut            statut_commande DEFAULT 'en_attente',
  penalite          BOOLEAN     DEFAULT FALSE,
  montant_total     NUMERIC(10, 2) NOT NULL,
  montant_final     NUMERIC(10, 2),
  statut_updated_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Lignes de commande
CREATE TABLE IF NOT EXISTS lignes_commande (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id     UUID          NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  type            TEXT          NOT NULL CHECK (type IN ('plat', 'menu')),
  plat_id         UUID          REFERENCES plats(id),
  menu_complet_id UUID          REFERENCES menus_complets(id),
  quantite        INT           NOT NULL DEFAULT 1,
  prix_unitaire   NUMERIC(10, 2) NOT NULL
);

-- Sélections d'options pour les lignes de commande
CREATE TABLE IF NOT EXISTS selections_options (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ligne_commande_id UUID NOT NULL REFERENCES lignes_commande(id) ON DELETE CASCADE,
  composant_id      UUID NOT NULL REFERENCES composants(id),
  option_id         UUID NOT NULL REFERENCES options(id),
  UNIQUE (ligne_commande_id, composant_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_commandes_structure   ON commandes(structure_id);
CREATE INDEX IF NOT EXISTS idx_commandes_date        ON commandes(date_commande);
CREATE INDEX IF NOT EXISTS idx_commandes_statut      ON commandes(statut);
