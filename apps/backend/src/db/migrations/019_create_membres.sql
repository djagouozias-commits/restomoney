-- Migration 019 : Membres de structure
-- Chaque structure peut avoir une liste de membres (contacts)
-- avec nom, téléphone et WhatsApp.

CREATE TABLE IF NOT EXISTS membres (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id    UUID        NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  nom             TEXT        NOT NULL,
  telephone       TEXT        NOT NULL,
  whatsapp        TEXT,                          -- numéro WhatsApp (téléphone par défaut)
  poste           TEXT,                          -- poste / fonction (optionnel)
  actif           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_membres_structure ON membres(structure_id);
