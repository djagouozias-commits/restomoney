-- Migration 021 : Ajout du champ capture_url à wallet_demandes
-- La structure envoie une capture de son dépôt mobile money
-- (Moov 0168204654 / MTN 0154824064) lors d'une demande de rechargement.
ALTER TABLE wallet_demandes
  ADD COLUMN IF NOT EXISTS capture_url TEXT;
