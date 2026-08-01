# Design Document — Meal Ordering App

## Overview

L'application **Meal Ordering App** est une plateforme web de commande de repas B2B connectant un restaurant/traiteur à ses entreprises clientes (Structures). Les Employés des Structures commandent parmi une offre quotidienne de plats du jour et de menus complets ; le Super_Admin pilote l'ensemble du cycle depuis un back-office dédié.

### Objectifs techniques

- **Mobile-first** : interface responsive Next.js, optimisée pour smartphone
- **Temps réel** : mise à jour du statut des commandes via Server-Sent Events (SSE)
- **Automatisation** : cron jobs pour la rotation des plats à minuit et la détection des retards
- **Traçabilité** : historique complet des commandes, tournées et rotations
- **Sécurité** : JWT + sessions serveur, isolation totale des données par Structure

### Promesse de marque

> *« Vos plats sont livrés bien chauds. Une promesse que nous honorons depuis 5 ans. »*

Affichée sur : page d'accueil, écran de confirmation de commande, reçu.

---

## Architecture

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│   ┌──────────────────────────────────────────────────┐  │
│   │          Next.js Frontend (apps/frontend)         │  │
│   │  - Pages Employé (commande, historique, reçu)    │  │
│   │  - Pages Back-Office Admin (CRUD, carte, stats)  │  │
│   │  - SSE Client (statut commandes temps réel)      │  │
│   │  - Leaflet.js (cartographie tournées)            │  │
│   └──────────────┬───────────────────────────────────┘  │
└──────────────────┼──────────────────────────────────────┘
                   │  HTTP REST + SSE
┌──────────────────▼──────────────────────────────────────┐
│           Node.js / Express Backend (apps/backend)       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  API REST (/api/v1/...)                         │    │
│  │  - Auth (JWT + sessions)                        │    │
│  │  - Structures, Plats, Menus                     │    │
│  │  - Commandes, Planning, Tournées                │    │
│  │  - SSE endpoint (/api/v1/events)                │    │
│  ├─────────────────────────────────────────────────┤    │
│  │  Cron Jobs                                      │    │
│  │  - Rotation à 00h00 (node-cron)                 │    │
│  │  - Détection retards (toutes les minutes)       │    │
│  ├─────────────────────────────────────────────────┤    │
│  │  Services Métier                                │    │
│  │  - AuthService, StructureService                │    │
│  │  - PlatService, MenuService                     │    │
│  │  - CommandeService, PlanningService             │    │
│  │  - TourneeService, PenaliteService              │    │
│  └──────────────────┬──────────────────────────────┘    │
└─────────────────────┼───────────────────────────────────┘
                      │  SQL (pg / node-postgres)
┌─────────────────────▼───────────────────────────────────┐
│                  PostgreSQL (local)                       │
└─────────────────────────────────────────────────────────┘
```

### Structure du monorepo

```
resto-money/
├── apps/
│   ├── frontend/          # Next.js 14 (App Router)
│   │   ├── app/
│   │   │   ├── (employee)/       # Pages Employé
│   │   │   └── admin/            # Back-office Super_Admin
│   │   ├── components/
│   │   └── lib/                  # Clients API, SSE hook
│   └── backend/           # Node.js / Express
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── middleware/
│       │   ├── cron/
│       │   └── db/               # Pool pg, migrations
│       └── package.json
├── packages/
│   └── shared/            # Types TypeScript partagés
└── package.json           # Workspace racine (npm/yarn workspaces)
```

### Flux d'authentification

```
Employé                    Frontend                  Backend               DB
  │                           │                         │                  │
  │── POST /auth/login ───────►│                         │                  │
  │                           │── POST /api/v1/auth/login►                  │
  │                           │                         │── SELECT structure│
  │                           │                         │◄─ structure row ──│
  │                           │                         │                  │
  │                           │◄── { accessToken, refreshToken, structureId }
  │◄─ cookie httpOnly (refresh)│                         │                  │
  │   localStorage (access)   │                         │                  │
```

---

## Components and Interfaces

### Frontend — Pages Employé

| Page | Route | Description |
|------|-------|-------------|
| Connexion | `/login` | Formulaire identifiant/mot de passe Structure |
| Accueil / Commande | `/` | 3 Plats du jour + Menus Complets + sélecteur créneaux |
| Panier | `/panier` | Récapitulatif, modification quantités, validation |
| Confirmation | `/confirmation/[id]` | Reçu avec promesse de marque |
| Historique | `/historique` | Liste des commandes passées de la Structure |
| Détail commande | `/commandes/[id]` | Reçu + statut en temps réel |

### Frontend — Pages Back-Office Admin

| Page | Route | Description |
|------|-------|-------------|
| Connexion Admin | `/admin/login` | Accès Super_Admin séparé |
| Dashboard | `/admin` | KPI : commandes du jour, retards, volume |
| Structures | `/admin/structures` | CRUD Structures, affichage credentials |
| Plats | `/admin/plats` | CRUD Plats (image, nom, prix, activation) |
| Planning | `/admin/planning` | Vue semaine 7 jours × 3 plats |
| Menus Complets | `/admin/menus` | CRUD Menus + Composants + Options |
| Commandes | `/admin/commandes` | Suivi statuts, filtres Structure/Créneau/Date |
| Retards & Pénalités | `/admin/retards` | Tableau retards, activation pénalités |
| Tournées | `/admin/tournees` | Carte Leaflet, réordonnancement, statuts |
| Journal Rotation | `/admin/rotation-log` | Historique exécutions cron rotation |

### Composants Frontend clés

```
components/
├── employee/
│   ├── DailyDishCard       # Carte plat du jour (image, prix, bouton ajout)
│   ├── MenuCompletCard     # Carte menu complet avec sélection options
│   ├── SlotSelector        # Sélecteur créneaux (grisé si délai dépassé)
│   ├── CartSidebar         # Panneau panier temps réel
│   ├── OrderReceipt        # Reçu avec promesse de marque
│   └── OrderStatusBadge    # Badge statut SSE (en attente / livraison / livré)
├── admin/
│   ├── WeeklyPlanningGrid  # Grille 7j × 3 plats drag & drop
│   ├── DeliveryMap         # Carte Leaflet tournée ordonnée
│   ├── OrderAggregTable    # Tableau agrégé par Structure/Créneau
│   ├── LateOrdersBoard     # Tableau retards avec bouton pénalité
│   └── RotationLogTable    # Journal horodaté rotations
└── shared/
    ├── ProtectedRoute      # HOC vérification JWT
    └── SSEProvider         # Context SSE pour statuts temps réel
```

### API REST — Interface Backend

Le backend expose toutes ses routes sous le préfixe `/api/v1`.

Middleware global :
- `authenticate` : vérifie le JWT access token
- `requireAdmin` : vérifie le rôle `super_admin`
- `structureScope` : injecte `req.structureId` et filtre les données

---

## Data Models

### Diagramme Entité-Association (simplifié)

```
Structure ──< Commande >── Creneau
    │               │
    │          Ligne_Commande >── Plat
    │          Ligne_Commande >── Menu_Complet
    │               │
    │         Selection_Option >── Option
    │
    └──< Tournee_Structure >── Tournee

Planning_Hebdomadaire >── Plat (3 par jour de semaine)
Surcharge_Jour >── Plat (3 par date précise)

Menu_Complet ──< Composant ──< Option
Rotation_Log (journal des rotations)
```

### Schéma PostgreSQL détaillé

```sql
-- =============================================
-- STRUCTURES (entreprises clientes)
-- =============================================
CREATE TABLE structures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           VARCHAR(255) NOT NULL,
  domaine       VARCHAR(255),
  telephone     VARCHAR(20),
  latitude      DECIMAL(10, 8) NOT NULL,
  longitude     DECIMAL(11, 8) NOT NULL,
  login         VARCHAR(100) UNIQUE NOT NULL,  -- identifiant généré
  password_hash VARCHAR(255) NOT NULL,          -- bcrypt
  actif         BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ADMIN (Super_Admin)
-- =============================================
CREATE TABLE admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PLATS
-- =============================================
CREATE TABLE plats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           VARCHAR(255) NOT NULL,
  description   TEXT,
  image_url     VARCHAR(500),
  prix          DECIMAL(10, 2) NOT NULL,
  actif         BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PLANNING HEBDOMADAIRE
-- =============================================
CREATE TABLE planning_hebdomadaire (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jour_semaine SMALLINT NOT NULL CHECK (jour_semaine BETWEEN 0 AND 6), -- 0=lundi, 6=dimanche
  plat_id     UUID NOT NULL REFERENCES plats(id),
  position    SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 3),
  UNIQUE (jour_semaine, position)
);

-- =============================================
-- SURCHARGES PONCTUELLES
-- =============================================
CREATE TABLE surcharges_jour (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_jour DATE NOT NULL,
  plat_id   UUID NOT NULL REFERENCES plats(id),
  position  SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 3),
  UNIQUE (date_jour, position)
);

-- =============================================
-- PLATS DU JOUR (état courant)
-- =============================================
CREATE TABLE plats_du_jour (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_jour DATE NOT NULL,
  plat_id   UUID NOT NULL REFERENCES plats(id),
  position  SMALLINT NOT NULL,
  actif     BOOLEAN DEFAULT TRUE,
  UNIQUE (date_jour, plat_id)
);

-- =============================================
-- MENUS COMPLETS
-- =============================================
CREATE TABLE menus_complets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         VARCHAR(255) NOT NULL,
  description TEXT,
  image_url   VARCHAR(500),
  prix        DECIMAL(10, 2) NOT NULL,
  actif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE composants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_complet_id UUID NOT NULL REFERENCES menus_complets(id) ON DELETE CASCADE,
  nom             VARCHAR(255) NOT NULL,
  a_choix         BOOLEAN DEFAULT FALSE,  -- true si sélection d'option requise
  position        SMALLINT NOT NULL
);

CREATE TABLE options (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composant_id UUID NOT NULL REFERENCES composants(id) ON DELETE CASCADE,
  nom          VARCHAR(255) NOT NULL,
  position     SMALLINT NOT NULL
);

-- =============================================
-- COMMANDES
-- =============================================
CREATE TYPE statut_commande AS ENUM (
  'en_attente', 'en_preparation', 'en_livraison', 'livre', 'en_retard'
);

CREATE TABLE commandes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id   UUID NOT NULL REFERENCES structures(id),
  creneau        TIME NOT NULL,                   -- 09:00, 12:00, 16:00, 20:00
  date_commande  DATE NOT NULL DEFAULT CURRENT_DATE,
  statut         statut_commande DEFAULT 'en_attente',
  penalite       BOOLEAN DEFAULT FALSE,
  montant_total  DECIMAL(10, 2) NOT NULL DEFAULT 0,
  montant_final  DECIMAL(10, 2),                  -- après pénalité éventuelle
  statut_updated_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lignes_commande (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id     UUID NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  plat_id         UUID REFERENCES plats(id),
  menu_complet_id UUID REFERENCES menus_complets(id),
  quantite        SMALLINT NOT NULL DEFAULT 1,
  prix_unitaire   DECIMAL(10, 2) NOT NULL,
  CHECK (
    (plat_id IS NOT NULL AND menu_complet_id IS NULL) OR
    (plat_id IS NULL AND menu_complet_id IS NOT NULL)
  )
);

CREATE TABLE selections_options (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ligne_commande_id UUID NOT NULL REFERENCES lignes_commande(id) ON DELETE CASCADE,
  composant_id     UUID NOT NULL REFERENCES composants(id),
  option_id        UUID NOT NULL REFERENCES options(id),
  UNIQUE (ligne_commande_id, composant_id)
);

-- =============================================
-- TOURNÉES
-- =============================================
CREATE TYPE statut_tournee AS ENUM (
  'planifiee', 'en_cours', 'terminee'
);

CREATE TABLE tournees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creneau       TIME NOT NULL,
  date_tournee  DATE NOT NULL,
  statut        statut_tournee DEFAULT 'planifiee',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tournee_structures (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournee_id   UUID NOT NULL REFERENCES tournees(id) ON DELETE CASCADE,
  structure_id UUID NOT NULL REFERENCES structures(id),
  ordre        SMALLINT NOT NULL,
  livre        BOOLEAN DEFAULT FALSE,
  livre_at     TIMESTAMPTZ,
  UNIQUE (tournee_id, ordre)
);

-- =============================================
-- JOURNAL ROTATIONS
-- =============================================
CREATE TYPE statut_rotation AS ENUM ('succes', 'echec');

CREATE TABLE rotation_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_jour   DATE NOT NULL,
  statut      statut_rotation NOT NULL,
  message     TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SESSIONS (refresh tokens)
-- =============================================
CREATE TABLE sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID NOT NULL,   -- structure_id ou admin_id
  entity_type  VARCHAR(20) NOT NULL CHECK (entity_type IN ('structure', 'admin')),
  refresh_token_hash VARCHAR(255) NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API REST

### Authentification

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| POST | `/api/v1/auth/login` | Connexion Structure | — |
| POST | `/api/v1/auth/admin/login` | Connexion Super_Admin | — |
| POST | `/api/v1/auth/refresh` | Renouveau access token | Refresh token cookie |
| POST | `/api/v1/auth/logout` | Révocation session | JWT |

### Structures (Admin)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/v1/admin/structures` | Liste toutes les Structures | Admin |
| POST | `/api/v1/admin/structures` | Créer une Structure (génère login/pwd) | Admin |
| GET | `/api/v1/admin/structures/:id` | Détail Structure | Admin |
| PUT | `/api/v1/admin/structures/:id` | Modifier Structure | Admin |
| PATCH | `/api/v1/admin/structures/:id/toggle` | Activer/Désactiver | Admin |
| POST | `/api/v1/admin/structures/:id/reset-password` | Régénérer mot de passe | Admin |

### Plats (Admin)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/v1/admin/plats` | Liste tous les Plats | Admin |
| POST | `/api/v1/admin/plats` | Créer un Plat (+ upload image) | Admin |
| PUT | `/api/v1/admin/plats/:id` | Modifier un Plat | Admin |
| PATCH | `/api/v1/admin/plats/:id/toggle` | Activer/Désactiver | Admin |

### Planning Hebdomadaire (Admin)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/v1/admin/planning` | Récupérer le planning complet (7 jours) | Admin |
| PUT | `/api/v1/admin/planning` | Enregistrer/Remplacer le planning entier | Admin |
| GET | `/api/v1/admin/planning/surcharges` | Liste des surcharges ponctuelles | Admin |
| POST | `/api/v1/admin/planning/surcharges` | Créer une surcharge pour une date | Admin |
| DELETE | `/api/v1/admin/planning/surcharges/:id` | Supprimer une surcharge | Admin |

### Menus Complets (Admin)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/v1/admin/menus` | Liste tous les Menus Complets | Admin |
| POST | `/api/v1/admin/menus` | Créer un Menu Complet | Admin |
| PUT | `/api/v1/admin/menus/:id` | Modifier (avec composants/options) | Admin |
| PATCH | `/api/v1/admin/menus/:id/toggle` | Activer/Désactiver | Admin |
| DELETE | `/api/v1/admin/menus/:id` | Supprimer | Admin |

### Interface Employé — Catalogue

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/v1/plats-du-jour` | Plats du jour courant (3 plats) | Structure JWT |
| GET | `/api/v1/menus` | Menus Complets actifs | Structure JWT |
| GET | `/api/v1/creneaux` | Créneaux disponibles (filtrés par délai 60 min) | Structure JWT |

### Commandes Employé

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| POST | `/api/v1/commandes` | Créer une commande | Structure JWT |
| GET | `/api/v1/commandes` | Historique commandes de la Structure | Structure JWT |
| GET | `/api/v1/commandes/:id` | Détail + reçu d'une commande | Structure JWT |

### Commandes Admin

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/v1/admin/commandes` | Toutes commandes (filtres: structure, creneau, date) | Admin |
| GET | `/api/v1/admin/commandes/aggregate` | Volume agrégé par plat/créneau | Admin |
| PATCH | `/api/v1/admin/commandes/:id/statut` | Mettre à jour le statut | Admin |
| POST | `/api/v1/admin/commandes/:id/penalite` | Appliquer pénalité 50 % | Admin |

### Tournées (Admin)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/v1/admin/tournees` | Liste tournées (filtre date/créneau) | Admin |
| POST | `/api/v1/admin/tournees` | Créer tournée pour un créneau/date | Admin |
| GET | `/api/v1/admin/tournees/:id` | Détail tournée + points ordonnés | Admin |
| PUT | `/api/v1/admin/tournees/:id/ordre` | Réordonner points d'arrêt manuellement | Admin |
| PATCH | `/api/v1/admin/tournees/:id/structures/:sid` | Marquer livraison effectuée au point | Admin |

### Retards

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/v1/admin/retards` | Commandes en retard (jour courant + historique) | Admin |

### SSE — Temps réel

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/v1/events` | Stream SSE statuts commandes | JWT |

### Rotation Logs

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/v1/admin/rotation-logs` | Journal des rotations | Admin |

---

## Cron Jobs

Deux cron jobs sont gérés par le package **`node-cron`** au démarrage du serveur Express.

### Cron 1 : Rotation Automatique des Plats (00h00)

**Schedule** : `0 0 * * *` (chaque jour à minuit)

**Algorithme** :

```
1. Déterminer le jour courant (lundi=0 … dimanche=6)
2. Vérifier si une entrée rotation_logs existe pour aujourd'hui avec statut='succes'
   → Si oui : arrêter (idempotence garantie)
3. BEGIN TRANSACTION
   a. Désactiver tous les plats_du_jour actifs de la veille
      UPDATE plats_du_jour SET actif = false WHERE date_jour = yesterday
   b. Chercher une surcharge_jour pour aujourd'hui
      → Si surcharge existe : utiliser ces 3 plats
      → Sinon : utiliser les 3 plats du planning_hebdomadaire pour ce jour de semaine
   c. Insérer les 3 plats dans plats_du_jour pour aujourd'hui (INSERT ON CONFLICT DO NOTHING)
4. COMMIT
5. INSERT rotation_logs (date=today, statut='succes')
6. En cas d'erreur :
   ROLLBACK
   INSERT rotation_logs (date=today, statut='echec', message=error.message)
   → Créer flag d'alerte visible dans le back-office (champ lu par /admin/rotation-logs)
```

**Idempotence** : la vérification en étape 2 et le `INSERT ON CONFLICT DO NOTHING` en étape 3c garantissent qu'une double exécution ne produit pas de doublons.

### Cron 2 : Détection des Retards (toutes les minutes)

**Schedule** : `* * * * *`

**Algorithme** :

```
1. Récupérer l'heure courante
2. Pour chaque créneau dépassé de plus de 10 minutes aujourd'hui :
   Creneaux = [09:00, 12:00, 16:00, 20:00]
   Pour chaque créneau C tel que NOW() > C + 10 minutes :
     UPDATE commandes
     SET statut = 'en_retard', statut_updated_at = NOW()
     WHERE date_commande = TODAY
       AND creneau = C
       AND statut NOT IN ('livre', 'en_retard')
3. Pour chaque commande passée en 'en_retard' :
   → Émettre un événement SSE vers les clients admin connectés
```

---

## Error Handling

### Stratégie globale

Tous les erreurs sont centralisées via un middleware Express `errorHandler` qui :
1. Normalise le format de réponse : `{ error: { code, message, details? } }`
2. Logue l'erreur avec contexte (request id, user id, timestamp)
3. Ne fuit jamais les stack traces en production

### Codes d'erreur métier

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Credentials incorrects |
| `AUTH_SESSION_EXPIRED` | 401 | Session expirée (JWT expiré) |
| `AUTH_FORBIDDEN` | 403 | Accès refusé (structure ≠ scope, non-admin) |
| `CRENEAU_NOT_AVAILABLE` | 422 | Créneau dépassant le délai de 60 min |
| `CRENEAU_NO_SLOTS` | 422 | Aucun créneau disponible aujourd'hui |
| `MENU_OPTION_REQUIRED` | 422 | Option manquante pour composant à choix |
| `PLAT_INACTIVE` | 422 | Plat non disponible à la commande |
| `RESOURCE_NOT_FOUND` | 404 | Ressource introuvable |
| `VALIDATION_ERROR` | 400 | Erreur de validation des champs |
| `ROTATION_FAILED` | 500 | Échec de la rotation automatique |

### Validation des entrées

- Côté backend : **Zod** pour valider les payloads des requêtes
- Côté frontend : **React Hook Form** + Zod pour les formulaires

### Sécurité et isolation

- Chaque requête Structure vérifie via middleware que `commande.structure_id === req.structureId`
- Les erreurs d'accès retournent toujours 403 sans détail (pas de fuite d'information)
- Les mots de passe sont hachés avec **bcrypt** (12 rounds)

---

## Testing Strategy

### Approche duale

1. **Tests unitaires** : exemples concrets, cas limites, erreurs
2. **Tests de propriétés** : invariants universels sur la logique métier (voir Correctness Properties)

### Outils

| Couche | Outil |
|--------|-------|
| Backend unit/integration | **Jest** + **supertest** |
| Property-based testing | **fast-check** (Node.js) |
| Frontend composants | **Vitest** + **Testing Library** |
| E2E | **Playwright** (smoke tests) |

### Tests unitaires prioritaires

- AuthService : login valide, credentials invalides, session expirée
- CommandeService : validation créneau 60 min, calcul montant, application pénalité 50 %
- PlanningService : résolution planning (surcharge vs hebdomadaire), idempotence rotation
- TourneeService : calcul ordre optimisé GPS (nearest neighbor)
- Cron rotation : exécution idempotente, gestion erreur

### Tests de propriétés (fast-check)

Configuration : **100 itérations minimum** par propriété.

Tag format : `// Feature: meal-ordering-app, Property N: <texte>`

Chaque propriété correctness ci-dessous est implémentée par un seul test property-based.

### Tests d'intégration

- Endpoints API avec base de données de test (PostgreSQL en mémoire ou schéma isolé)
- Flux complet : login → commande → mise à jour statut → SSE reçu
- Rotation : déclenchement cron → vérification plats_du_jour


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1 : Authentification des credentials valides

*Pour tout* credential de Structure actif (login + mot de passe correct), le service d'authentification SHALL retourner un access token JWT dont le `structureId` correspond à la Structure associée à ces credentials.

**Validates: Requirements 1.2**

---

### Property 2 : Rejet de toute authentification invalide ou Structure inactive

*Pour tout* couple (login, password) qui ne correspond pas à une Structure active en base, le service d'authentification SHALL rejeter la tentative et retourner une erreur `AUTH_INVALID_CREDENTIALS` — que les credentials soient incorrects ou que la Structure soit désactivée.

**Validates: Requirements 1.3, 2.5**

---

### Property 3 : Isolation des données par Structure

*Pour toute* Structure A authentifiée, toute requête sur les ressources de commandes (liste, historique, détail) SHALL retourner uniquement des enregistrements dont le `structure_id` est égal à l'identifiant de la Structure A. Aucune donnée d'une Structure B ≠ A ne doit être incluse dans la réponse.

**Validates: Requirements 1.4, 14.2**

---

### Property 4 : Unicité des logins générés automatiquement

*Pour tout* ensemble de N créations successives de Structures, les logins générés automatiquement SHALL être tous distincts — aucune collision ne doit survenir, quelle que soit la valeur de N ≥ 1.

**Validates: Requirements 2.2**

---

### Property 5 : Invariant du login lors des modifications de Structure

*Pour toute* Structure existante et toute modification de ses attributs (nom, domaine, téléphone, coordonnées GPS, statut), le champ `login` de la Structure SHALL rester identique à sa valeur d'origine après la modification.

**Validates: Requirements 2.4**

---

### Property 6 : Correction de la Rotation Automatique

*Pour tout* planning hebdomadaire valide (7 jours × 3 plats) et toute date cible, l'exécution de la rotation automatique SHALL produire exactement les 3 plats correspondant à ce jour dans le planning (ou dans la surcharge ponctuelle si elle existe) dans la table `plats_du_jour`, et désactiver tous les plats du jour précédent.

**Validates: Requirements 3.5, 4.2, 11.1**

---

### Property 7 : Idempotence de la Rotation Automatique

*Pour tout* planning valide et toute date cible, exécuter la rotation automatique N fois de suite (N ≥ 1) pour cette même date SHALL produire un état de `plats_du_jour` identique à celui obtenu après la première exécution — sans duplication ni modification des entrées existantes.

**Validates: Requirements 4.2, 11.2**

---

### Property 8 : Priorité de la surcharge ponctuelle sur le planning hebdomadaire

*Pour toute* date pour laquelle une `surcharge_jour` est définie, la résolution des plats du jour SHALL retourner les 3 plats de la surcharge et non les 3 plats du `planning_hebdomadaire` pour ce jour de semaine.

**Validates: Requirements 4.3, 4.4**

---

### Property 9 : Invariant du prix fixe des Menus Complets

*Pour tout* Menu_Complet et toute combinaison d'Options sélectionnées par un Employé parmi les Composants à choix, le montant calculé pour ce Menu_Complet dans la commande SHALL être strictement égal au `prix` fixe du Menu_Complet, sans variation selon les options choisies.

**Validates: Requirements 5.3**

---

### Property 10 : Validation des options obligatoires des Menus Complets

*Pour tout* Menu_Complet contenant N Composants avec `a_choix = true` (N ≥ 1), toute tentative de création de commande avec moins de N sélections d'options (ou avec une sélection manquante pour au moins un composant) SHALL être rejetée avec l'erreur `MENU_OPTION_REQUIRED`.

**Validates: Requirements 5.4**

---

### Property 11 : Règle des 60 minutes sur les créneaux

*Pour tout* couple (heure_courante, créneau), si la différence `créneau - heure_courante < 60 minutes`, alors ce créneau SHALL être considéré non disponible par le service de validation. Si la différence `créneau - heure_courante ≥ 60 minutes`, le créneau SHALL être considéré disponible.

**Validates: Requirements 6.2, 6.3**

---

### Property 12 : Cohérence de l'agrégation des volumes par créneau

*Pour tout* ensemble de commandes d'un créneau donné, le volume agrégé retourné par l'API SHALL être tel que, pour chaque `plat_id` ou `menu_complet_id`, la somme agrégée soit strictement égale à la somme des quantités de toutes les lignes de commande correspondantes.

**Validates: Requirements 8.3**

---

### Property 13 : Détection automatique des retards

*Pour toute* commande dont le créneau est dépassé depuis plus de 10 minutes (c.-à-d. `NOW() > créneau + 10 min`) et dont le statut n'est pas `livre`, l'exécution du cron de détection SHALL mettre à jour le statut de cette commande en `en_retard`.

**Validates: Requirements 9.1**

---

### Property 14 : Calcul de la pénalité à 50 %

*Pour toute* commande en retard avec un `montant_total` M (M > 0), l'application de la clause de pénalité SHALL produire un `montant_final` égal à `M × 0.5`, quel que soit le montant M.

**Validates: Requirements 9.3**

---

### Property 15 : Invalidation du mot de passe après régénération

*Pour toute* Structure dont le mot de passe a été régénéré par le Super_Admin, une tentative d'authentification avec l'ancien mot de passe SHA NOT réussir — quelle que soit la valeur de l'ancien mot de passe.

**Validates: Requirements 14.4**
