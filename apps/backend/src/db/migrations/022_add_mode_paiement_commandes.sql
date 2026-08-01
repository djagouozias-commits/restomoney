-- Migration 022 : Ajout du mode de paiement aux commandes
-- 'especes' = paiement cash à la livraison
-- 'wallet'  = débit automatique du solde RestoMoney avant livraison
ALTER TABLE commandes
  ADD COLUMN IF NOT EXISTS mode_paiement TEXT NOT NULL DEFAULT 'especes'
    CHECK (mode_paiement IN ('especes', 'wallet'));
