/**
 * Types partagés — Wallet RestoMoney
 * Ces interfaces reflètent le schéma des tables wallets,
 * wallet_transactions et wallet_demandes défini dans la migration 020.
 */

/** Statuts possibles d'une demande de complément de fonds. */
export type DemandeStatut =
  | 'en_attente'
  | 'acceptee'
  | 'collecte_en_cours'
  | 'completee'
  | 'refusee';

/** Types d'opérations financières enregistrées dans wallet_transactions. */
export type TransactionType = 'recharge' | 'debit' | 'credit_demande';

/** Portefeuille électronique associé à une structure. */
export interface Wallet {
  id: string;
  structure_id: string;
  /** Solde en FCFA — entier ≥ 0. */
  solde: number;
  created_at: string;
  updated_at: string;
}

/** Enregistrement d'une opération financière sur un wallet. */
export interface Transaction {
  id: string;
  wallet_id: string;
  type: TransactionType;
  /** Montant de l'opération en FCFA — toujours > 0. */
  montant: number;
  /** Solde du wallet immédiatement avant l'opération. */
  solde_avant: number;
  /** Solde du wallet immédiatement après l'opération. */
  solde_apres: number;
  /** Identifiant de l'admin ayant déclenché l'opération (null pour les débits structure). */
  admin_id?: string;
  /** Référence externe optionnelle (ex : ID de commande, ID de demande). */
  reference?: string;
  created_at: string;
}

/** Données nécessaires pour soumettre une demande de complément de fonds. */
export interface DemandeInput {
  /** Montant demandé en FCFA — doit être > 0. */
  montant_demande: number;
  /** Adresse où l'agent viendra collecter les fonds physiquement. */
  adresse_collecte: string;
  /** Contact à joindre pour l'opération de collecte. */
  contact: string;
  /** Notes complémentaires optionnelles. */
  notes?: string;
}

/** Demande de complément de fonds soumise par une structure. */
export interface Demande {
  id: string;
  structure_id: string;
  montant_demande: number;
  adresse_collecte: string;
  contact: string;
  notes?: string;
  statut: DemandeStatut;
  /** Motif renseigné par l'admin en cas de refus. */
  motif_refus?: string;
  /** Identifiant de l'admin ayant traité la demande. */
  admin_id?: string;
  created_at: string;
  updated_at: string;
}

/** Résultat paginé d'une requête de transactions. */
export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  limit: number;
}
