// Enums / Types littéraux
export type StatutCommande = 'en_attente' | 'en_preparation' | 'en_livraison' | 'livre' | 'en_retard';
export type StatutTournee = 'planifiee' | 'en_cours' | 'terminee';
export type StatutRotation = 'succes' | 'echec';
export type EntityType = 'structure' | 'admin';
export type JourSemaine = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=lundi, 6=dimanche
export type Creneau = '09:00' | '12:00' | '16:00' | '20:00';

// Structure (entreprise cliente)
export interface Structure {
  id: string;
  nom: string;
  domaine: string | null;
  telephone: string | null;
  latitude: number;
  longitude: number;
  login: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

// Admin
export interface Admin {
  id: string;
  email: string;
  created_at: string;
}

// Plat
export interface Plat {
  id: string;
  nom: string;
  description: string | null;
  image_url: string | null;
  prix: number;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

// Planning hebdomadaire
export interface PlanningEntry {
  id: string;
  jour_semaine: JourSemaine;
  plat_id: string;
  position: 1 | 2 | 3;
  plat?: Plat;
}

// Surcharge ponctuelle
export interface SurchargeJour {
  id: string;
  date_jour: string; // ISO date YYYY-MM-DD
  plat_id: string;
  position: 1 | 2 | 3;
  plat?: Plat;
}

// Plat du jour (état courant)
export interface PlatDuJour {
  id: string;
  date_jour: string;
  plat_id: string;
  position: number;
  actif: boolean;
  plat?: Plat;
}

// Option d'un composant
export interface Option {
  id: string;
  composant_id: string;
  nom: string;
  position: number;
}

// Composant d'un menu complet
export interface Composant {
  id: string;
  menu_complet_id: string;
  nom: string;
  type: 'fixe' | 'choix';   // 'choix' si sélection d'option requise
  a_choix: boolean;          // alias DB : true = type 'choix'
  position: number;
  options?: Option[];
}

// Menu complet (combo)
export interface MenuComplet {
  id: string;
  nom: string;
  description: string | null;
  image_url: string | null;
  prix: number;
  actif: boolean;
  created_at: string;
  updated_at: string;
  composants?: Composant[];
}

// Sélection d'option dans une ligne de commande
export interface SelectionOption {
  id: string;
  ligne_commande_id: string;
  composant_id: string;
  option_id: string;
}

// Ligne de commande
export interface LigneCommande {
  id: string;
  commande_id: string;
  type: 'plat' | 'menu';    // discriminant : ligne plat ou ligne menu complet
  plat_id: string | null;
  menu_complet_id: string | null;
  quantite: number;
  prix_unitaire: number;
  plat?: Plat;
  menu_complet?: MenuComplet;
  selections_options?: SelectionOption[];
}

// Commande
export interface Commande {
  id: string;
  structure_id: string;
  creneau: string; // HH:MM:SS
  date_commande: string; // ISO date
  statut: StatutCommande;
  penalite: boolean;
  montant_total: number;
  montant_final: number | null;
  statut_updated_at: string | null;
  created_at: string;
  structure?: Structure;
  lignes?: LigneCommande[];
}

// Structure dans une tournée (point d'arrêt)
export interface TourneeStructure {
  id: string;
  tournee_id: string;
  structure_id: string;
  ordre: number;
  livre: boolean;
  livre_at: string | null;
  structure?: Structure;
}

// Tournée de livraison
export interface Tournee {
  id: string;
  creneau: string;
  date_tournee: string;
  statut: StatutTournee;
  created_at: string;
  points?: TourneeStructure[];
}

// Journal de rotation automatique
export interface RotationLog {
  id: string;
  date_jour: string;
  statut: StatutRotation;
  message: string | null;
  executed_at: string;
}

// Payloads API
export interface CreateStructurePayload {
  nom: string;
  domaine?: string;
  telephone?: string;
  latitude: number;
  longitude: number;
}

export interface CreatePlatPayload {
  nom: string;
  description?: string;
  prix: number;
}

export interface CreateMenuCompletPayload {
  nom: string;
  description?: string;
  prix: number;
  composants: {
    nom: string;
    a_choix: boolean;
    position: number;
    options?: { nom: string; position: number }[];
  }[];
}

export interface CreateCommandePayload {
  creneau: string; // HH:MM
  lignes: {
    plat_id?: string;
    menu_complet_id?: string;
    quantite: number;
    selections_options?: { composant_id: string; option_id: string }[];
  }[];
}

export interface CreneauInfo {
  heure: string; // "09:00"
  disponible: boolean;
  raison?: string;
}
