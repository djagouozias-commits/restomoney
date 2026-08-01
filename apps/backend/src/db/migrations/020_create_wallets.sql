-- Migration 020 : Wallets des structures (RestoMoney)
-- Chaque structure dispose d'un portefeuille électronique en FCFA.
-- Les tables wallet_transactions et wallet_demandes tracent les opérations
-- et les demandes de complément de fonds.

-- ============================================================
-- Table : wallets
-- Un wallet unique par structure (contrainte UNIQUE sur structure_id).
-- Le solde est stocké en BIGINT pour éviter les débordements sur
-- de gros montants FCFA. CHECK (solde >= 0) est un filet de sécurité
-- côté base de données en complément des vérifications applicatives.
-- ============================================================
CREATE TABLE IF NOT EXISTS wallets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID        NOT NULL UNIQUE REFERENCES structures(id) ON DELETE CASCADE,
  solde        BIGINT      NOT NULL DEFAULT 0 CHECK (solde >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_structure ON wallets(structure_id);

-- ============================================================
-- Table : wallet_transactions
-- Enregistre chaque opération financière : recharge admin,
-- débit structure, ou crédit suite à une demande complétée.
-- admin_id peut être NULL pour les débits initiés par la structure.
-- reference permet de lier la transaction à une commande ou demande.
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id   UUID        NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('recharge', 'debit', 'credit_demande')),
  montant     BIGINT      NOT NULL CHECK (montant > 0),
  solde_avant BIGINT      NOT NULL,
  solde_apres BIGINT      NOT NULL,
  admin_id    UUID        REFERENCES admins(id),
  reference   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet  ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(created_at DESC);

-- ============================================================
-- Table : wallet_demandes
-- Demandes de complément de fonds soumises par une structure.
-- Le statut suit la machine à états :
--   en_attente → acceptee → collecte_en_cours → completee
--   en_attente → refusee
-- motif_refus est renseigné uniquement lors d'un refus.
-- admin_id désigne l'admin qui a traité la demande (nullable).
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_demandes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id     UUID        NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  montant_demande  BIGINT      NOT NULL CHECK (montant_demande > 0),
  adresse_collecte TEXT        NOT NULL,
  contact          TEXT        NOT NULL,
  notes            TEXT,
  statut           TEXT        NOT NULL DEFAULT 'en_attente'
                               CHECK (statut IN ('en_attente', 'acceptee', 'collecte_en_cours', 'completee', 'refusee')),
  motif_refus      TEXT,
  admin_id         UUID        REFERENCES admins(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demandes_structure ON wallet_demandes(structure_id);
CREATE INDEX IF NOT EXISTS idx_demandes_statut    ON wallet_demandes(statut);
