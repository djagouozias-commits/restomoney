-- Migration 009: Création de la table parametres_sanctions
-- Stocke les niveaux de sanction configurables par l'administrateur

CREATE TABLE IF NOT EXISTS parametres_sanctions (
  niveau        INT  PRIMARY KEY CHECK (niveau BETWEEN 1 AND 4),
  min_minutes   INT  NOT NULL CHECK (min_minutes >= 0),
  max_minutes   INT,  -- NULL = illimité (borne supérieure ouverte)
  reduction_pct INT  NOT NULL CHECK (reduction_pct BETWEEN 0 AND 100),
  emettre_bon   BOOLEAN NOT NULL DEFAULT FALSE
);

-- Valeurs par défaut
-- Niveau 1 : 5–9 min → −50 %, pas de bon
-- Niveau 2 : 10–19 min → −100 %, pas de bon
-- Niveau 3 : 20+ min → −100 %, bon de réduction émis
INSERT INTO parametres_sanctions (niveau, min_minutes, max_minutes, reduction_pct, emettre_bon) VALUES
  (1,  5,    9,  50,  false),
  (2, 10,   19, 100,  false),
  (3, 20, NULL, 100,  true)
ON CONFLICT (niveau) DO NOTHING;
