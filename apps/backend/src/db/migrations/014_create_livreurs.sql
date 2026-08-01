-- Migration 014 : Création de la table livreurs
-- Gestion des livreurs avec authentification et zone habituelle

CREATE TABLE IF NOT EXISTS livreurs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  login          TEXT        UNIQUE NOT NULL,
  nom            TEXT        NOT NULL,
  zone_habituelle TEXT       NOT NULL DEFAULT '',
  password_hash  TEXT        NOT NULL,
  actif          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_livreurs_login ON livreurs(login);
