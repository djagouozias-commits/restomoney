-- Migration 007 : Ajouter la colonne employe_id dans commandes
-- Permet de savoir quel employé a passé quelle commande.

ALTER TABLE commandes
  ADD COLUMN IF NOT EXISTS employe_id UUID REFERENCES employes(id) ON DELETE SET NULL;

ALTER TABLE commandes
  ADD COLUMN IF NOT EXISTS employe_login TEXT; -- dénormalisé pour l'affichage dans les récaps

CREATE INDEX IF NOT EXISTS idx_commandes_employe ON commandes(employe_id);
