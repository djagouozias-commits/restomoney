-- Migration 012 : Option couverts jetables
-- avec_jetable sur plats : l'admin peut activer l'option pour un plat
-- jetable sur lignes_commande : choix de l'employé lors de la commande

ALTER TABLE plats ADD COLUMN IF NOT EXISTS avec_jetable BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE lignes_commande ADD COLUMN IF NOT EXISTS jetable BOOLEAN NOT NULL DEFAULT FALSE;
