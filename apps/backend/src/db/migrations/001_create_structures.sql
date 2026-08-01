-- =============================================
-- MIGRATION 001 — Structures, Admins, Sessions
-- =============================================

-- Structures (entreprises clientes)
CREATE TABLE IF NOT EXISTS structures (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           TEXT        NOT NULL,
  domaine       TEXT,
  telephone     TEXT,
  latitude      NUMERIC     NOT NULL,
  longitude     NUMERIC     NOT NULL,
  login         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  actif         BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Admins (Super_Admin)
CREATE TABLE IF NOT EXISTS admins (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions (refresh tokens)
CREATE TABLE IF NOT EXISTS sessions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id          UUID        NOT NULL,
  entity_type        TEXT        NOT NULL CHECK (entity_type IN ('structure', 'admin')),
  refresh_token_hash TEXT        NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les lookups de sessions par entité
CREATE INDEX IF NOT EXISTS idx_sessions_entity_id ON sessions (entity_id);
