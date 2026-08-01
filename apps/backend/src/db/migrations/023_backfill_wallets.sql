-- Migration 023 : Création des wallets manquants pour les structures existantes
-- Pour chaque structure qui n'a pas encore de wallet, on en crée un avec solde 0.
INSERT INTO wallets (structure_id, solde)
SELECT id, 0
FROM structures
WHERE id NOT IN (SELECT structure_id FROM wallets)
ON CONFLICT (structure_id) DO NOTHING;
