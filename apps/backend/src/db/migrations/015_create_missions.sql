-- Migration 015 : Création de la table missions
-- Missions de livraison assignées aux livreurs avec suivi de statut

CREATE TABLE IF NOT EXISTS missions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  livreur_id      UUID        NOT NULL REFERENCES livreurs(id),
  date_mission    DATE        NOT NULL,
  circuit         TEXT        NOT NULL DEFAULT '',
  statut_mission  TEXT        NOT NULL DEFAULT 'en_attente'
                              CHECK (statut_mission IN ('en_attente', 'en_route', 'terminee', 'annulee')),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missions_livreur_id     ON missions(livreur_id);
CREATE INDEX IF NOT EXISTS idx_missions_date_mission   ON missions(date_mission);
CREATE INDEX IF NOT EXISTS idx_missions_statut_mission ON missions(statut_mission);

-- Table de liaison missions ↔ commandes
CREATE TABLE IF NOT EXISTS mission_commandes (
  mission_id       UUID  NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  commande_id      UUID  NOT NULL REFERENCES commandes(id) ON DELETE RESTRICT,
  statut_livraison TEXT  NOT NULL DEFAULT 'a_livrer'
                         CHECK (statut_livraison IN ('a_livrer', 'livre')),
  PRIMARY KEY (mission_id, commande_id)
);

CREATE INDEX IF NOT EXISTS idx_mission_commandes_commande_id ON mission_commandes(commande_id);
