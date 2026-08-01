# Design Document — Interface Livreur

## Overview

Cette fonctionnalité ajoute une dimension "livraison" à l'application resto-money. Elle introduit un nouveau rôle `livreur` orthogonal aux rôles existants (`admin`, `structure`, `employe`), un modèle de mission permettant de grouper des commandes en tournées journalières, et deux interfaces distinctes :

- **Admin** : créer/gérer des livreurs, composer et suivre des missions en temps réel.
- **Livreur** : voir ses missions du jour, progresser étape par étape, consulter son historique.

L'ensemble s'intègre dans l'architecture monorepo existante (Express/TypeScript backend + Next.js App Router frontend) sans casser les flux actuels.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│                                                                  │
│  /admin/livreurs     /admin/missions      /livreur/dashboard     │
│  (CRUD livreurs)     (créer/suivre)       (mes missions)         │
│         │                  │                      │              │
│         └──────────────────┴──────────────────────┘             │
│                             │ fetch / polling                    │
└─────────────────────────────┼───────────────────────────────────┘
                              │ HTTP + JWT Bearer
┌─────────────────────────────┼───────────────────────────────────┐
│                        Backend (Express)                         │
│                                                                  │
│  /api/v1/auth/unified-login  (étendu → livreurs)                │
│  /api/v1/admin/livreurs/*    (requireAdmin)                      │
│  /api/v1/admin/missions/*    (requireAdmin)                      │
│  /api/v1/livreur/*           (requireLivreur)                   │
│                                                                  │
│  AuthService ──────► LivreurService ◄──── CommandeService       │
│       │                                                          │
│  middleware/auth.ts  (authenticate, requireAdmin, requireLivreur)│
└─────────────────────────────────────────────────────────────────┘
                              │ pg pool
┌─────────────────────────────┼───────────────────────────────────┐
│                        PostgreSQL                                │
│                                                                  │
│  livreurs   missions   mission_commandes   sessions (existant)   │
│  employes   commandes  structures          (existants)           │
└─────────────────────────────────────────────────────────────────┘
```

### Flux d'authentification unifié

```
unified-login(identifier, password)
    ├─ loginAdmin(identifier)         ← email admin
    ├─ loginStructure(identifier)     ← login structure / employé
    └─ loginLivreur(identifier)  [NOUVEAU]  ← login livreur
            │
            └─ JWT { role: 'livreur', entityId: livreur.id }
                        │
                        └─ redirect → /livreur/dashboard
```

### Flux de progression d'une mission

```
en_attente ──[Livreur: En route]──► en_route
                                       │
                              [Livreur: marque chaque commande 'livre']
                                       │
                          [toutes livrees → bouton "Terminer" actif]
                                       │
                        [Livreur: Terminer]──► terminee
                                                  │
                                    [commandes.statut = 'livre' en masse]

[Admin: Annuler] peut intervenir sur en_attente ou en_route → annulee
```

---

## Components and Interfaces

### Backend — nouveaux fichiers

#### `src/db/migrations/014_create_livreurs.sql`
Table des comptes livreurs indépendante des `employes`.

#### `src/db/migrations/015_create_missions.sql`
Table `missions` et table de jonction `mission_commandes`.

#### `src/services/livreurService.ts`

```typescript
interface LivreurCreateInput {
  login: string;
  password: string;
  nom: string;
  zone_habituelle: string;
}

interface LivreurUpdateInput {
  nom?: string;
  zone_habituelle?: string;
  actif?: boolean;
}

interface MissionCreateInput {
  livreur_id: string;
  date_mission: string;       // YYYY-MM-DD
  circuit: string;
  commande_ids: string[];
}

interface MissionUpdateInput {
  circuit?: string;
  date_mission?: string;
  commande_ids?: string[];
}

export const LivreurService = {
  // Livreurs
  createLivreur(input: LivreurCreateInput): Promise<Livreur>,
  listLivreurs(): Promise<Livreur[]>,
  updateLivreur(id: string, input: LivreurUpdateInput): Promise<Livreur>,
  resetPassword(id: string): Promise<{ login: string; plainPassword: string }>,
  deactivateLivreur(id: string): Promise<void>,          // invalide sessions

  // Missions
  createMission(input: MissionCreateInput): Promise<Mission>,
  getMissionsToday(livreurId?: string): Promise<MissionWithCommandes[]>,
  getMission(id: string): Promise<MissionWithCommandes>,
  updateMission(id: string, input: MissionUpdateInput): Promise<Mission>,
  cancelMission(id: string): Promise<Mission>,

  // Progression livreur
  startMission(missionId: string, livreurId: string): Promise<Mission>,
  markCommandeLivree(missionId: string, commandeId: string, livreurId: string): Promise<void>,
  completeMission(missionId: string, livreurId: string): Promise<Mission>,

  // Historique
  getHistorique(livreurId: string, page: number): Promise<{ missions: Mission[]; total: number }>,
};
```

#### `src/routes/admin/livreurs.ts`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/admin/livreurs` | Liste tous les livreurs |
| POST | `/admin/livreurs` | Crée un livreur |
| PATCH | `/admin/livreurs/:id` | Modifie nom/zone_habituelle/actif |
| POST | `/admin/livreurs/:id/reset-password` | Réinitialise le mot de passe |
| POST | `/admin/livreurs/:id/deactivate` | Désactive + invalide sessions |

#### `src/routes/admin/missions.ts`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/admin/missions?date=YYYY-MM-DD` | Missions du jour (ou date) groupées par livreur |
| POST | `/admin/missions` | Crée une mission |
| PATCH | `/admin/missions/:id` | Modifie (si en_attente) |
| POST | `/admin/missions/:id/cancel` | Annule |
| GET | `/admin/missions/commandes-par-zone?date=...` | Vue par zone/circuit |

#### `src/routes/livreur.ts`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/livreur/missions/today` | Missions du jour du livreur connecté |
| GET | `/livreur/missions/historique?page=1` | Historique paginé (20/page) |
| POST | `/livreur/missions/:id/start` | Passe en_attente → en_route |
| POST | `/livreur/missions/:id/commandes/:commandeId/livre` | Marque une commande livrée |
| POST | `/livreur/missions/:id/complete` | Passe en_route → terminee |

#### `src/middleware/auth.ts` — extension

Ajout de `requireLivreur` et `livreurScope` :

```typescript
export function requireLivreur(req, res, next): void;
// Vérifie req.role === 'livreur', sinon 403

export function livreurScope(req, res, next): void;
// Vérifie que le livreur_id dans params/body === req.userId (entityId JWT)
```

#### `src/types/express.d.ts` — extension

```typescript
declare namespace Express {
  interface Request {
    userId?: string;
    role?: 'structure' | 'admin' | 'employe' | 'livreur';  // + livreur
    structureId?: string;
    employeId?: string;
    livreurId?: string;   // NOUVEAU
  }
}
```

### Frontend — nouveaux fichiers

#### `app/admin/livreurs/page.tsx`
- Liste des livreurs (tableau : login, nom, zone_habituelle, actif, actions).
- Formulaire de création en modal/panel.
- Actions inline : modifier, reset mot de passe (affiche le MdP en clair une fois), désactiver/réactiver.

#### `app/admin/missions/page.tsx`
- Onglet "Créer une mission" : sélectionner livreur, circuit, date, commandes à assigner.
- Onglet "Suivi du jour" : missions groupées par livreur, filtre par statut, rafraîchissement auto (polling 30s).
- Onglet "Commandes par zone" : sélectionner date, voir commandes groupées par circuit.

#### `app/livreur/dashboard/page.tsx`
- Section "Aujourd'hui" : missions du jour, boutons de progression.
- Section "Historique" : missions passées paginées.
- Rafraîchissement auto (polling 30s).
- Gestion des missions annulées (badge "Annulée", actions désactivées).

#### Mise à jour `app/admin/page.tsx`
Ajout de deux liens dans la grille de navigation :
- `{ href: '/admin/livreurs', label: 'Livreurs' }`
- `{ href: '/admin/missions', label: 'Missions' }`

---

## Data Models

### Table `livreurs` (migration 014)

```sql
CREATE TABLE livreurs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  login          TEXT        UNIQUE NOT NULL,
  nom            TEXT        NOT NULL,
  zone_habituelle TEXT       NOT NULL DEFAULT '',
  password_hash  TEXT        NOT NULL,
  actif          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_livreurs_login ON livreurs(login);
```

### Table `missions` (migration 015)

```sql
CREATE TABLE missions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  livreur_id     UUID        NOT NULL REFERENCES livreurs(id) ON DELETE CASCADE,
  date_mission   DATE        NOT NULL,
  circuit        TEXT        NOT NULL,
  statut_mission TEXT        NOT NULL DEFAULT 'en_attente'
                             CHECK (statut_mission IN ('en_attente','en_route','terminee','annulee')),
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_missions_livreur     ON missions(livreur_id);
CREATE INDEX idx_missions_date        ON missions(date_mission);
CREATE INDEX idx_missions_statut      ON missions(statut_mission);
```

### Table `mission_commandes` (migration 015)

```sql
CREATE TABLE mission_commandes (
  mission_id     UUID        NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  commande_id    UUID        NOT NULL REFERENCES commandes(id) ON DELETE RESTRICT,
  statut_livraison TEXT      NOT NULL DEFAULT 'a_livrer'
                             CHECK (statut_livraison IN ('a_livrer','livre')),
  PRIMARY KEY (mission_id, commande_id)
);

CREATE INDEX idx_mc_commande ON mission_commandes(commande_id);
```

### Extension `sessions` (existante)
La table `sessions` accepte déjà un `entity_type` TEXT libre — aucun changement de schéma nécessaire. Les sessions livreur auront `entity_type = 'livreur'`.

### TypeScript types

```typescript
// Statuts
type StatutMission = 'en_attente' | 'en_route' | 'terminee' | 'annulee';
type StatutLivraison = 'a_livrer' | 'livre';

interface Livreur {
  id: string;
  login: string;
  nom: string;
  zone_habituelle: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

interface Mission {
  id: string;
  livreur_id: string;
  date_mission: string;        // YYYY-MM-DD
  circuit: string;
  statut_mission: StatutMission;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MissionCommande {
  mission_id: string;
  commande_id: string;
  statut_livraison: StatutLivraison;
  // Jointures pour affichage
  structure_nom?: string;
  latitude?: number;
  longitude?: number;
  creneau?: string;
  montant_total?: number;
  statut_commande?: string;
}

interface MissionWithCommandes extends Mission {
  commandes: MissionCommande[];
  livrees: number;   // count statut_livraison='livre'
  total: number;     // count total
}
```

---

## Correctness Properties

*Une propriété est une caractéristique ou un comportement qui doit rester vrai pour toutes les exécutions valides d'un système — essentiellement, un énoncé formel sur ce que le logiciel doit faire. Les propriétés servent de pont entre les spécifications lisibles par les humains et les garanties de correction vérifiables par les machines.*

### Property 1 : Création de livreur — hash bcrypt valide

*Pour tout* input valide de création de livreur (login, password, nom, zone_habituelle), le `password_hash` stocké dans la base ne doit pas être égal au mot de passe en clair, et `bcrypt.compare(password, hash)` doit retourner `true`.

**Validates: Requirements 1.2**

### Property 2 : Login dupliqué toujours rejeté

*Pour tout* login de livreur déjà enregistré dans la table `livreurs`, toute tentative de création d'un second livreur avec ce même login doit retourner l'erreur `LIVREUR_LOGIN_DUPLICATE`.

**Validates: Requirements 1.3**

---

### Property 3 : Mise à jour partielle — champs non modifiés préservés

*Pour tout* livreur existant et pour tout sous-ensemble des champs modifiables {nom, zone_habituelle, actif}, une requête PATCH ne doit modifier que les champs explicitement fournis ; les autres champs doivent conserver leur valeur d'avant la requête.

**Validates: Requirements 1.4**

---

### Property 4 : Désactivation invalide toutes les sessions

*Pour tout* livreur avec N sessions actives (N ≥ 0), après sa désactivation, une requête `SELECT` sur `sessions` avec `entity_id = livreur.id AND entity_type = 'livreur'` doit retourner 0 lignes.

**Validates: Requirements 1.6**

---

### Property 5 : JWT livreur contient le bon rôle et entityId

*Pour tout* livreur actif avec des identifiants valides, le JWT retourné par `/auth/unified-login` doit décoder avec `role = 'livreur'` et `entityId = livreur.id`.

**Validates: Requirements 2.2**

---

### Property 6 : Compte inactif → AUTH_INVALID_CREDENTIALS systématique

*Pour tout* livreur avec `actif = false`, quelle que soit la valeur du mot de passe fourni (correct ou incorrect), l'authentification doit retourner `AUTH_INVALID_CREDENTIALS`.

**Validates: Requirements 2.3**

---

### Property 7 : Isolation des données — un livreur ne voit que ses missions

*Pour tout* couple (livreur A, livreur B) avec A ≠ B, les missions retournées par le endpoint `/livreur/missions/today` avec le JWT de A ne doivent contenir aucune mission dont `livreur_id = B.id`.

**Validates: Requirements 2.5, 4.1**

---

### Property 8 : Création de mission — statut initial et commandes persistés

*Pour tout* payload valide de création de mission (livreur_id, date_mission, circuit, commande_ids non vides), la mission persistée doit avoir `statut_mission = 'en_attente'` et `mission_commandes` doit contenir exactement les `commande_id` fournis, tous avec `statut_livraison = 'a_livrer'`.

**Validates: Requirements 3.1**

---

### Property 9 : Commande inexistante → MISSION_COMMANDE_NOT_FOUND

*Pour tout* UUID ne correspondant à aucun enregistrement dans `commandes`, inclure cet UUID dans une création de mission doit retourner `MISSION_COMMANDE_NOT_FOUND`.

**Validates: Requirements 3.2**

---

### Property 10 : Missions terminées sont immuables

*Pour toute* mission avec `statut_mission = 'terminee'`, toute tentative de modification (PATCH) ou d'annulation (POST cancel) doit retourner `MISSION_ALREADY_COMPLETED`.

**Validates: Requirements 3.4, 3.6**

---

### Property 11 : Annulation possible sur tout statut non-terminé

*Pour toute* mission avec `statut_mission ∈ {en_attente, en_route}`, une demande d'annulation doit toujours résulter en `statut_mission = 'annulee'`, quelles que soient les autres données de la mission.

**Validates: Requirements 3.5**

---

### Property 12 : Missions du jour — filtre date et livreur strict

*Pour tout* livreur avec des missions sur plusieurs dates, le endpoint `/livreur/missions/today` doit retourner uniquement les missions où `livreur_id = JWT.entityId` ET `date_mission = CURRENT_DATE`.

**Validates: Requirements 4.1**

---

### Property 13 : Réponse mission complète — tous les champs requis présents

*Pour toute* mission retournée dans la vue livreur, la réponse doit inclure `circuit`, `statut_mission`, et pour chaque commande associée : `structures.nom`, `structures.latitude`, `structures.longitude`, `creneau`.

**Validates: Requirements 4.2**

---

### Property 14 : Transition en_attente → en_route enregistre started_at

*Pour toute* mission avec `statut_mission = 'en_attente'`, après appel à `startMission`, le `statut_mission` doit être `'en_route'` et `started_at` doit être un horodatage non-null proche du moment de l'appel (±5s).

**Validates: Requirements 5.1**

---

### Property 15 : Transitions invalides → MISSION_INVALID_TRANSITION

*Pour toute* mission avec `statut_mission ∉ {en_attente}` (respectivement `∉ {en_route}`), tenter de la démarrer (respectivement de la terminer) doit retourner `MISSION_INVALID_TRANSITION`.

**Validates: Requirements 5.2, 5.6**

---

### Property 16 : Complétion de mission met à jour commandes.statut en masse

*Pour toute* mission en_route avec N commandes, après appel à `completeMission`, toutes les N commandes dans la table `commandes` dont l'id est dans `mission_commandes.commande_id` doivent avoir `statut = 'livre'`.

**Validates: Requirements 5.7**

---

### Property 17 : Historique — uniquement missions passées, ordre décroissant

*Pour tout* livreur avec des missions sur des dates variées (passées et futures), le endpoint historique doit retourner uniquement les missions avec `date_mission < CURRENT_DATE`, triées par `date_mission DESC`.

**Validates: Requirements 8.1**

---

### Property 18 : Pagination — au plus 20 missions par page

*Pour tout* livreur avec N missions historiques, chaque page du résultat paginé doit contenir au plus 20 missions, et l'ensemble des pages doit couvrir exactement N missions sans doublon ni omission.

**Validates: Requirements 8.4**

---

### Property 19 : Contrôle d'accès — routes admin/livreurs protégées par rôle admin

*Pour tout* JWT avec `role ≠ admin`, toute requête sur `/api/v1/admin/livreurs/*` doit retourner HTTP 403.

**Validates: Requirements 9.1**

---

### Property 20 : Contrôle d'accès — routes /livreur/* protégées par rôle livreur

*Pour tout* JWT avec `role ≠ livreur`, toute requête sur `/api/v1/livreur/*` doit retourner HTTP 403.

**Validates: Requirements 9.2**

---

### Property 21 : Isolation des opérations — un livreur ne peut pas agir pour un autre

*Pour tout* couple (livreur A, livreur B) avec A ≠ B, une requête portant le JWT de A vers un endpoint `/livreur/missions/:id/...` où la mission appartient à B doit retourner HTTP 403.

**Validates: Requirements 9.3, 9.4**

---

## Error Handling

### Codes d'erreur métier

| Code | HTTP | Description |
|------|------|-------------|
| `LIVREUR_LOGIN_DUPLICATE` | 409 | Login déjà pris dans la table `livreurs` |
| `MISSION_COMMANDE_NOT_FOUND` | 404 | Une `commande_id` n'existe pas |
| `MISSION_ALREADY_COMPLETED` | 409 | Tentative de modifier/annuler une mission terminée |
| `MISSION_INVALID_TRANSITION` | 409 | Transition de statut invalide |
| `AUTH_INVALID_CREDENTIALS` | 401 | Identifiants invalides ou compte inactif |
| `AUTH_FORBIDDEN` | 403 | Rôle ou identité insuffisant |
| `RESOURCE_NOT_FOUND` | 404 | Livreur ou mission introuvable |

### Principes

- Aucun message d'erreur ne doit distinguer "compte inexistant" de "mot de passe incorrect" ni "compte inactif" pour les livreurs (requirement 2.3).
- Les erreurs 403 liées à l'isolation ne doivent pas révéler l'existence des données d'un autre livreur.
- Toutes les erreurs passent par le middleware `errorHandler` existant via `AppError`.
- Les opérations multi-étapes (création mission + insertion mission_commandes, complétion mission + update commandes) s'exécutent dans des transactions PostgreSQL.

---

## Testing Strategy

### Approche duale

**Tests unitaires / d'exemple** — pour les comportements concrets et les intégrations UI :
- Affichage du formulaire de création livreur (champs requis présents)
- Affichage de la liste livreurs (colonnes login, nom, zone_habituelle, actif)
- Affichage d'une mission annulée avec badge + boutons désactivés
- Modification d'une mission `en_attente` (cas nominal)
- Redirection vers `/livreur/dashboard` après login réussi
- Filtrage admin des missions par statut

**Tests de propriétés (property-based)** — pour les invariants universels :
- Bibliothèque : [fast-check](https://github.com/dubzzz/fast-check) (TypeScript, côté backend)
- Configuration : minimum **100 itérations** par propriété
- Tag format : `// Feature: livreur-interface, Property {N}: {property_text}`
- Chaque propriété du document correspond à un test property-based unique
- Les appels DB sont mockés pour les propriétés testant la logique pure (ex : validation des transitions), et utilisent une DB de test pour les propriétés testant la persistance

### Propriétés à implémenter en tests fast-check (priorité haute)

| Property | Description courte |
|----------|--------------------|
| P1 | Hash bcrypt valide à la création |
| P2 | Login dupliqué → LIVREUR_LOGIN_DUPLICATE |
| P3 | PATCH partiel préserve les champs non modifiés |
| P4 | Désactivation efface les sessions |
| P7 | Isolation missions livreur A ≠ livreur B |
| P8 | Mission créée avec statut en_attente + commandes correctes |
| P9 | commande_id inexistante → MISSION_COMMANDE_NOT_FOUND |
| P10 | Missions terminées immuables |
| P11 | Annulation toujours possible si non-terminée |
| P15 | Transitions invalides → MISSION_INVALID_TRANSITION |
| P16 | Complétion mission met à jour toutes les commandes |
| P19 | 403 sur admin/livreurs/* si rôle ≠ admin |
| P20 | 403 sur /livreur/* si rôle ≠ livreur |
| P21 | 403 si livreur accède aux missions d'un autre |

### Tests d'intégration

- Login unifié : résolution dans l'ordre admin → structure/employé → livreur
- Cycle complet d'une mission (en_attente → en_route → terminee) avec vérification DB
- Vérification que `commandes.statut` passe à `'livre'` après complétion de mission
