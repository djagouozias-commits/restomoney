# Implementation Plan: Meal Ordering App

## Overview

Implémentation complète en monorepo TypeScript : backend Node.js/Express + frontend Next.js 14 + PostgreSQL. Les tâches suivent un ordre séquentiel strict — chaque tâche s'appuie sur les précédentes, jusqu'au câblage final.

## Tasks

- [x] 1. Setup du monorepo
  - [x] 1.1 Initialiser le `package.json` racine avec `workspaces: ["apps/*", "packages/*"]`, scripts `dev`, `build`, `lint` et configuration TypeScript racine (`tsconfig.base.json`)
    - Créer `resto-money/package.json` (workspaces npm), `tsconfig.base.json`, `.gitignore`, `.nvmrc`
    - _Requirements: architecture monorepo_
  - [x] 1.2 Créer le package `packages/shared` avec les types TypeScript partagés
    - Définir les interfaces : `Structure`, `Plat`, `MenuComplet`, `Composant`, `Option`, `Commande`, `LigneCommande`, `SelectionOption`, `Tournee`, `TourneeStructure`, `RotationLog`, `StatutCommande`, `StatutTournee`
    - Exporter depuis `packages/shared/src/index.ts`
    - _Requirements: 1.x, 2.x, 5.x, 6.x, 8.x, 9.x, 10.x_

- [x] 2. Setup du backend (apps/backend)
  - [x] 2.1 Initialiser `apps/backend/package.json` avec les dépendances : `express`, `pg`, `jsonwebtoken`, `bcrypt`, `zod`, `node-cron`, `multer`, `cors`, `cookie-parser`, `uuid` et leurs types `@types/*`
    - Configurer `tsconfig.json` backend, scripts `dev` (ts-node-dev), `build` (tsc), `start`
    - Créer la structure de dossiers : `src/routes/`, `src/services/`, `src/middleware/`, `src/cron/`, `src/db/`
    - _Requirements: architecture backend_
  - [x] 2.2 Créer le serveur Express principal (`src/index.ts`)
    - Configurer middlewares globaux : `cors`, `cookie-parser`, `express.json()`, `express.urlencoded()`
    - Monter le préfixe `/api/v1` et le middleware `errorHandler`
    - Charger les variables d'environnement (`dotenv`) : `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`
    - _Requirements: 14.1, 14.3_

- [x] 3. Base de données — Migrations PostgreSQL
  - [x] 3.1 Créer le pool de connexion PostgreSQL (`src/db/pool.ts`) et le runner de migrations (`src/db/migrate.ts`)
    - Configurer `pg.Pool` depuis `DATABASE_URL`
    - Écrire la fonction `runMigrations()` qui exécute les fichiers SQL dans l'ordre
    - _Requirements: architecture DB_
  - [x] 3.2 Écrire la migration `001_create_structures.sql`
    - Tables : `structures`, `admins`, `sessions`
    - _Requirements: 2.1, 2.2, 14.5_
  - [x] 3.3 Écrire la migration `002_create_plats.sql`
    - Tables : `plats`, `planning_hebdomadaire`, `surcharges_jour`, `plats_du_jour`
    - _Requirements: 3.1, 4.1, 4.3_
  - [x] 3.4 Écrire la migration `003_create_menus.sql`
    - Tables : `menus_complets`, `composants`, `options`
    - _Requirements: 5.1, 5.2_
  - [x] 3.5 Écrire la migration `004_create_commandes.sql`
    - Types ENUM : `statut_commande`, `statut_tournee`, `statut_rotation`
    - Tables : `commandes`, `lignes_commande`, `selections_options`
    - _Requirements: 6.6, 7.5, 8.4, 9.3_
  - [x] 3.6 Écrire la migration `005_create_tournees_logs.sql`
    - Tables : `tournees`, `tournee_structures`, `rotation_logs`
    - _Requirements: 10.1, 10.5, 11.4_

- [x] 4. Auth backend
  - [x] 4.1 Implémenter `AuthService` (`src/services/authService.ts`)
    - Méthodes : `loginStructure(login, password)`, `loginAdmin(email, password)`, `refreshToken(token)`, `logout(sessionId)`, `generateTokenPair(entityId, entityType)`
    - Utiliser `bcrypt.compare` (12 rounds), générer JWT access (15 min) + refresh (7 jours), stocker `refresh_token_hash` dans `sessions`
    - _Requirements: 1.2, 1.3, 1.5, 14.4_
  - [ ]* 4.2 Écrire le test de propriété pour l'authentification — Property 1 & 2
    - **Property 1 : Authentification des credentials valides** — `fast-check`, 100 itérations
    - **Property 2 : Rejet de toute authentification invalide ou Structure inactive** — `fast-check`, 100 itérations
    - **Validates: Requirements 1.2, 1.3, 2.5**
  - [x] 4.3 Créer les routes auth (`src/routes/auth.ts`) : `POST /auth/login`, `POST /auth/admin/login`, `POST /auth/refresh`, `POST /auth/logout`
    - Valider les payloads avec Zod
    - Poser le cookie `httpOnly` pour le refresh token
    - _Requirements: 1.2, 1.3, 1.5_
  - [x] 4.4 Implémenter les middlewares `authenticate`, `requireAdmin`, `structureScope` (`src/middleware/auth.ts`)
    - `authenticate` : vérifie et décode le JWT access token, injecte `req.userId`, `req.role`
    - `requireAdmin` : vérifie `req.role === 'super_admin'`
    - `structureScope` : injecte `req.structureId` et valide l'isolation
    - _Requirements: 1.4, 14.1, 14.2, 14.3_
  - [ ]* 4.5 Écrire le test de propriété pour l'isolation des données — Property 3
    - **Property 3 : Isolation des données par Structure**
    - **Validates: Requirements 1.4, 14.2**

- [x] 5. CRUD Structures (backend)
  - [x] 5.1 Implémenter `StructureService` (`src/services/structureService.ts`)
    - Méthodes : `create(data)`, `list()`, `getById(id)`, `update(id, data)`, `toggle(id)`, `resetPassword(id)`
    - Générer automatiquement `login` unique (slug + suffixe aléatoire) et `password` aléatoire (bcrypt 12 rounds)
    - Retourner `{ login, plainPassword }` uniquement à la création et au reset
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 14.4, 14.5_
  - [ ]* 5.2 Écrire le test de propriété pour l'unicité des logins — Property 4
    - **Property 4 : Unicité des logins générés automatiquement**
    - **Validates: Requirements 2.2**
  - [ ]* 5.3 Écrire le test de propriété pour l'invariant du login — Property 5
    - **Property 5 : Invariant du login lors des modifications de Structure**
    - **Validates: Requirements 2.4**
  - [ ]* 5.4 Écrire le test de propriété pour l'invalidation du mot de passe — Property 15
    - **Property 15 : Invalidation du mot de passe après régénération**
    - **Validates: Requirements 14.4**
  - [x] 5.5 Créer les routes admin structures (`src/routes/admin/structures.ts`)
    - `GET /admin/structures`, `POST /admin/structures`, `GET /admin/structures/:id`, `PUT /admin/structures/:id`, `PATCH /admin/structures/:id/toggle`, `POST /admin/structures/:id/reset-password`
    - Valider les payloads avec Zod ; appliquer middleware `requireAdmin`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 6. CRUD Plats (backend)
  - [x] 6.1 Implémenter `PlatService` (`src/services/platService.ts`)
    - Méthodes : `create(data)`, `list()`, `update(id, data)`, `toggle(id)`
    - Gérer l'upload d'image avec `multer` (stockage local `uploads/plats/`)
    - _Requirements: 3.1, 3.4_
  - [x] 6.2 Créer les routes admin plats (`src/routes/admin/plats.ts`)
    - `GET /admin/plats`, `POST /admin/plats` (multipart/form-data), `PUT /admin/plats/:id`, `PATCH /admin/plats/:id/toggle`
    - Valider avec Zod, appliquer `requireAdmin` + `multer`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 6.3 Servir les fichiers statiques `uploads/` depuis Express
    - `app.use('/uploads', express.static('uploads'))`
    - _Requirements: 3.3, 13.3_

- [x] 7. Planning hebdomadaire + Surcharges (backend)
  - [x] 7.1 Implémenter `PlanningService` (`src/services/planningService.ts`)
    - Méthodes : `getPlanning()`, `savePlanning(data)`, `getSurcharges()`, `createSurcharge(data)`, `deleteSurcharge(id)`, `resolvePlatsDuJour(date)` (priorité surcharge > hebdomadaire)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ]* 7.2 Écrire le test de propriété pour la priorité surcharge — Property 8
    - **Property 8 : Priorité de la surcharge ponctuelle sur le planning hebdomadaire**
    - **Validates: Requirements 4.3, 4.4**
  - [x] 7.3 Créer les routes admin planning (`src/routes/admin/planning.ts`)
    - `GET /admin/planning`, `PUT /admin/planning`, `GET /admin/planning/surcharges`, `POST /admin/planning/surcharges`, `DELETE /admin/planning/surcharges/:id`
    - Valider avec Zod, appliquer `requireAdmin`
    - _Requirements: 4.1, 4.3, 4.5_

- [x] 8. Menus Complets + Composants + Options (backend)
  - [x] 8.1 Implémenter `MenuService` (`src/services/menuService.ts`)
    - Méthodes : `list()`, `create(data)`, `update(id, data)`, `toggle(id)`, `delete(id)`, `getWithComposants(id)`
    - Gérer la persistance en cascade : menu → composants → options (DELETE CASCADE déjà en DB)
    - _Requirements: 5.1, 5.2, 5.5, 5.6_
  - [x] 8.2 Créer les routes admin menus (`src/routes/admin/menus.ts`)
    - `GET /admin/menus`, `POST /admin/menus`, `PUT /admin/menus/:id`, `PATCH /admin/menus/:id/toggle`, `DELETE /admin/menus/:id`
    - Valider payload avec Zod (menu + composants + options imbriqués)
    - _Requirements: 5.1, 5.2, 5.5, 5.6_
  - [x] 8.3 Créer la route employé menus (`src/routes/menus.ts`)
    - `GET /menus` : retourner uniquement les menus actifs avec leurs composants et options
    - Appliquer middleware `authenticate`
    - _Requirements: 7.2, 5.3_

- [x] 9. Commandes — création, validation créneau, historique (backend)
  - [x] 9.1 Implémenter `CommandeService` (`src/services/commandeService.ts`)
    - Méthode `create(structureId, payload)` : valider créneaux 60 min, vérifier plats actifs, vérifier options obligatoires, calculer `montant_total`, insérer `commandes` + `lignes_commande` + `selections_options` dans une transaction
    - Méthodes `listByStructure(structureId)`, `getById(id, structureId)` (isolation)
    - _Requirements: 6.2, 6.3, 6.6, 7.3, 7.5, 7.7, 5.4_
  - [ ]* 9.2 Écrire le test de propriété pour la règle des 60 minutes — Property 11
    - **Property 11 : Règle des 60 minutes sur les créneaux**
    - **Validates: Requirements 6.2, 6.3**
  - [ ]* 9.3 Écrire le test de propriété pour les options obligatoires — Property 10
    - **Property 10 : Validation des options obligatoires des Menus Complets**
    - **Validates: Requirements 5.4**
  - [ ]* 9.4 Écrire le test de propriété pour le prix fixe des menus — Property 9
    - **Property 9 : Invariant du prix fixe des Menus Complets**
    - **Validates: Requirements 5.3**
  - [x] 9.5 Créer les routes employé commandes (`src/routes/commandes.ts`)
    - `POST /commandes`, `GET /commandes`, `GET /commandes/:id`
    - Appliquer `authenticate` + `structureScope` + validation Zod
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 7.5, 12.1, 12.2, 12.3_
  - [x] 9.6 Créer la route employé créneaux (`src/routes/creneaux.ts`)
    - `GET /creneaux` : retourner les 4 créneaux filtrés selon la règle 60 min
    - `GET /plats-du-jour` : retourner les 3 plats du jour courant actifs
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1_

- [x] 10. Cron rotation minuit (backend)
  - [x] 10.1 Implémenter `RotationService` (`src/services/rotationService.ts`)
    - Méthode `executerRotation(date)` : algorithme complet en transaction (désactiver veille, résoudre surcharge/hebdo, insérer `plats_du_jour` avec `ON CONFLICT DO NOTHING`, journaliser dans `rotation_logs`)
    - Idempotence : vérifier `rotation_logs` avant exécution
    - _Requirements: 3.5, 4.2, 11.1, 11.2, 11.3, 11.4_
  - [ ]* 10.2 Écrire le test de propriété pour la correction de la rotation — Property 6
    - **Property 6 : Correction de la Rotation Automatique**
    - **Validates: Requirements 3.5, 4.2, 11.1**
  - [ ]* 10.3 Écrire le test de propriété pour l'idempotence de la rotation — Property 7
    - **Property 7 : Idempotence de la Rotation Automatique**
    - **Validates: Requirements 4.2, 11.2**
  - [x] 10.4 Créer le cron job rotation (`src/cron/rotationCron.ts`)
    - Schedule `0 0 * * *`, appeler `RotationService.executerRotation(today)`
    - Journaliser succès/échec dans `rotation_logs`
    - _Requirements: 11.1, 11.3, 11.4_
  - [x] 10.5 Créer la route admin rotation logs (`src/routes/admin/rotationLogs.ts`)
    - `GET /admin/rotation-logs` : liste horodatée des rotations
    - _Requirements: 11.3, 11.4_

- [ ] 11. Cron détection retards (backend)
  - [ ] 11.1 Implémenter `RetardService` (`src/services/retardService.ts`)
    - Méthode `detecterRetards()` : pour chaque créneau dépassé de > 10 min, `UPDATE commandes SET statut = 'en_retard'` où statut ≠ `livre`
    - Retourner la liste des commandes passées en `en_retard` pour diffusion SSE
    - _Requirements: 9.1_
  - [ ]* 11.2 Écrire le test de propriété pour la détection des retards — Property 13
    - **Property 13 : Détection automatique des retards**
    - **Validates: Requirements 9.1**
  - [~] 11.3 Créer le cron job retards (`src/cron/retardCron.ts`)
    - Schedule `* * * * *`, appeler `RetardService.detecterRetards()` et émettre événements SSE
    - _Requirements: 9.1, 9.2_

- [ ] 12. Pénalités (backend)
  - [~] 12.1 Implémenter `PenaliteService` (`src/services/penaliteService.ts`)
    - Méthode `appliquerPenalite(commandeId)` : calculer `montant_final = montant_total * 0.5`, setter `penalite = true`, `montant_final`
    - _Requirements: 9.3, 9.4_
  - [ ]* 12.2 Écrire le test de propriété pour le calcul de pénalité — Property 14
    - **Property 14 : Calcul de la pénalité à 50 %**
    - **Validates: Requirements 9.3**
  - [~] 12.3 Créer les routes admin commandes + retards (`src/routes/admin/commandes.ts`)
    - `GET /admin/commandes`, `GET /admin/commandes/aggregate`, `PATCH /admin/commandes/:id/statut`, `POST /admin/commandes/:id/penalite`
    - `GET /admin/retards`
    - Valider avec Zod, appliquer `requireAdmin`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.2, 9.3, 9.4, 9.5, 12.4_
  - [ ]* 12.4 Écrire le test de propriété pour l'agrégation des volumes — Property 12
    - **Property 12 : Cohérence de l'agrégation des volumes par créneau**
    - **Validates: Requirements 8.3**

- [ ] 13. Tournées (backend)
  - [~] 13.1 Implémenter `TourneeService` (`src/services/tourneeService.ts`)
    - Méthodes : `create(creneau, date)` (calcul ordre nearest-neighbor depuis coordonnées GPS), `list(filters)`, `getById(id)`, `reordonner(id, ordre)`, `marquerLivraison(tourneeId, structureId)`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  - [~] 13.2 Créer les routes admin tournées (`src/routes/admin/tournees.ts`)
    - `GET /admin/tournees`, `POST /admin/tournees`, `GET /admin/tournees/:id`, `PUT /admin/tournees/:id/ordre`, `PATCH /admin/tournees/:id/structures/:sid`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 14. SSE (backend)
  - [~] 14.1 Implémenter le gestionnaire SSE (`src/services/sseService.ts`)
    - Gérer un registre de clients connectés (Map par `structureId` ou `admin`)
    - Méthodes : `addClient(res, entityId, role)`, `removeClient(entityId)`, `emit(event, data, target?)` (broadcast admin ou unicast structure)
    - _Requirements: 7.3 (temps réel statut), 9.2 (alerte retard)_
  - [~] 14.2 Créer la route SSE (`src/routes/events.ts`)
    - `GET /events` : headers `text/event-stream`, appliquer `authenticate`, enregistrer client, nettoyer à la déconnexion
    - _Requirements: 7.3_

- [~] 15. Checkpoint backend — tous les tests passent
  - Vérifier que toutes les migrations s'exécutent sans erreur
  - Lancer `jest --runInBand` dans `apps/backend` — tous les tests property et unitaires doivent passer
  - Corriger toute erreur avant de passer au frontend

- [ ] 16. Setup frontend Next.js (apps/frontend)
  - [~] 16.1 Initialiser `apps/frontend` avec Next.js 14 App Router, TypeScript, Tailwind CSS, `eslint`
    - Configurer `tsconfig.json` pour importer depuis `packages/shared`
    - Installer dépendances : `react-hook-form`, `zod`, `@hookform/resolvers`, `leaflet`, `react-leaflet`, `@types/leaflet`
    - Créer la structure de dossiers : `app/(employee)/`, `app/admin/`, `components/employee/`, `components/admin/`, `components/shared/`, `lib/`
    - _Requirements: 13.1_
  - [~] 16.2 Créer les clients API (`lib/api.ts`) et le hook SSE (`lib/useSSE.ts`)
    - `apiFetch` : wrapper `fetch` avec gestion du token JWT (header Authorization), refresh automatique, gestion erreurs normalisées
    - `useSSE(url)` : hook React qui ouvre un `EventSource`, écoute les événements, retourne l'état courant
    - _Requirements: 7.3, 9.2_
  - [~] 16.3 Implémenter le composant `ProtectedRoute` et le contexte d'authentification (`lib/AuthContext.tsx`)
    - Stocker l'access token en mémoire (pas localStorage), appeler `POST /auth/refresh` au montage
    - Rediriger vers `/login` si non authentifié
    - _Requirements: 14.1, 1.5_

- [ ] 17. Interface connexion (frontend)
  - [~] 17.1 Créer la page `/login` (`app/(employee)/login/page.tsx`) et la page `/admin/login` (`app/admin/login/page.tsx`)
    - Formulaire React Hook Form + Zod : champ identifiant + mot de passe
    - Appeler `POST /api/v1/auth/login` (employé) ou `POST /api/v1/auth/admin/login` (admin)
    - Afficher message d'erreur générique si échec (pas de détail login/mdp)
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [ ] 18. Interface de commande Employé — plats du jour, menus, panier (frontend)
  - [~] 18.1 Créer le composant `DailyDishCard` (`components/employee/DailyDishCard.tsx`)
    - Afficher image, nom, description, prix ; bouton « Ajouter au panier »
    - _Requirements: 7.1, 13.3_
  - [~] 18.2 Créer le composant `MenuCompletCard` (`components/employee/MenuCompletCard.tsx`)
    - Afficher image, nom, description, prix fixe ; modale/drawer pour sélection d'options pour chaque composant à choix
    - Bloquer l'ajout si un composant à choix n'a pas d'option sélectionnée
    - _Requirements: 7.2, 5.3, 5.4_
  - [~] 18.3 Créer le contexte panier (`lib/CartContext.tsx`) et le composant `CartSidebar` (`components/employee/CartSidebar.tsx`)
    - État panier : articles, quantités, montant total recalculé en temps réel
    - Actions : ajouter, modifier quantité, retirer article, vider panier
    - _Requirements: 7.3, 7.4_
  - [~] 18.4 Créer la page d'accueil commande (`app/(employee)/page.tsx`)
    - Charger `GET /plats-du-jour` et `GET /menus`, afficher `DailyDishCard` × 3 + `MenuCompletCard`
    - Afficher la promesse de marque en haut de page
    - _Requirements: 7.1, 7.2, 7.6, 13.2_

- [ ] 19. Interface de commande Employé — sélecteur créneaux, validation, confirmation (frontend)
  - [~] 19.1 Créer le composant `SlotSelector` (`components/employee/SlotSelector.tsx`)
    - Charger `GET /creneaux`, afficher 4 créneaux avec distinction visuelle disponible/grisé
    - _Requirements: 6.1, 6.3, 6.4, 13.4_
  - [~] 19.2 Créer la page panier (`app/(employee)/panier/page.tsx`)
    - Intégrer `CartSidebar` + `SlotSelector` + bouton « Valider la commande »
    - Appeler `POST /commandes` à la validation ; vider le panier en cas de succès
    - Gérer les erreurs API : `CRENEAU_NOT_AVAILABLE`, `MENU_OPTION_REQUIRED`, `PLAT_INACTIVE`
    - _Requirements: 6.2, 6.5, 7.4, 7.5_
  - [~] 19.3 Créer le composant `OrderReceipt` (`components/employee/OrderReceipt.tsx`) et la page de confirmation (`app/(employee)/confirmation/[id]/page.tsx`)
    - Afficher identifiant commande, date, créneau, structure, articles, montant total, pénalité si applicable, promesse de marque
    - _Requirements: 7.5, 7.6, 12.1, 12.2, 12.4_

- [ ] 20. Historique commandes Employé (frontend)
  - [~] 20.1 Créer la page historique (`app/(employee)/historique/page.tsx`) et la page détail commande (`app/(employee)/commandes/[id]/page.tsx`)
    - Charger `GET /commandes` ; afficher liste avec date, créneau, statut, montant
    - Page détail : afficher `OrderReceipt` + `OrderStatusBadge` SSE en temps réel
    - _Requirements: 7.7, 12.3_
  - [~] 20.2 Créer le composant `OrderStatusBadge` (`components/employee/OrderStatusBadge.tsx`)
    - Connecter au hook `useSSE`, mettre à jour le badge statut (en attente / en préparation / en livraison / livré / en retard) en temps réel
    - _Requirements: 7.3_

- [ ] 21. Back-office Admin — Dashboard (frontend)
  - [~] 21.1 Créer la page dashboard admin (`app/admin/page.tsx`)
    - KPIs du jour : nombre de commandes, retards actifs, volume total par créneau
    - Charger `GET /admin/commandes?date=today`, `GET /admin/retards`
    - Alerte visuelle si `rotation_logs` indique un échec récent
    - _Requirements: 8.1, 9.2, 11.3_

- [ ] 22. Back-office Admin — Gestion Structures (frontend)
  - [~] 22.1 Créer la page structures admin (`app/admin/structures/page.tsx`) et le formulaire de création/modification
    - Tableau CRUD : liste des structures avec statut, domaine, coordonnées GPS
    - Formulaire React Hook Form + Zod pour création et modification
    - Afficher `{ login, plainPassword }` dans une modale après création/reset — non réaffichable ensuite
    - Boutons toggle actif/inactif et reset mot de passe
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 23. Back-office Admin — Gestion Plats (frontend)
  - [~] 23.1 Créer la page plats admin (`app/admin/plats/page.tsx`)
    - Carrousel/grille avec image, nom, description, prix, statut actif/inactif
    - Formulaire création/modification avec upload image (multipart/form-data)
    - Bouton toggle actif/inactif
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 24. Back-office Admin — Planning hebdomadaire (frontend)
  - [~] 24.1 Créer le composant `WeeklyPlanningGrid` (`components/admin/WeeklyPlanningGrid.tsx`)
    - Grille 7 jours × 3 positions, chaque cellule = sélecteur de plat (liste déroulante des plats actifs)
    - Charger `GET /admin/planning`, sauvegarder via `PUT /admin/planning`
    - _Requirements: 4.1, 4.5_
  - [~] 24.2 Créer la section surcharges ponctuelles dans la page planning (`app/admin/planning/page.tsx`)
    - Formulaire date + 3 sélecteurs de plats pour créer une surcharge
    - Liste des surcharges existantes avec bouton suppression
    - _Requirements: 4.3_

- [ ] 25. Back-office Admin — Menus Complets (frontend)
  - [~] 25.1 Créer la page menus admin (`app/admin/menus/page.tsx`)
    - CRUD Menus Complets : formulaire imbriqué (menu + composants + options) avec React Hook Form
    - Upload image, toggle actif/inactif, suppression
    - _Requirements: 5.1, 5.2, 5.5, 5.6_

- [ ] 26. Back-office Admin — Suivi Commandes + Agrégation (frontend)
  - [~] 26.1 Créer le composant `OrderAggregTable` (`components/admin/OrderAggregTable.tsx`) et la page commandes admin (`app/admin/commandes/page.tsx`)
    - Filtres : structure, créneau (09h/12h/16h/20h), date
    - Tableau agrégé : volume par plat/menu par créneau (`GET /admin/commandes/aggregate`)
    - Liste des commandes individuelles avec bouton changement de statut
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 27. Back-office Admin — Retards & Pénalités (frontend)
  - [~] 27.1 Créer le composant `LateOrdersBoard` (`components/admin/LateOrdersBoard.tsx`) et la page retards (`app/admin/retards/page.tsx`)
    - Tableau des commandes en retard : structure, créneau, montant, statut pénalité
    - Distinction visuelle : retard sans pénalité / retard avec pénalité / livré dans les délais
    - Bouton « Appliquer pénalité 50 % » — appelle `POST /admin/commandes/:id/penalite`
    - Mise à jour SSE des nouvelles commandes passées en retard
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 28. Back-office Admin — Tournées + Carte Leaflet (frontend)
  - [~] 28.1 Créer le composant `DeliveryMap` (`components/admin/DeliveryMap.tsx`)
    - Carte Leaflet avec marqueurs ordonnés (restaurant + structures de la tournée)
    - Ligne de trajet reliant les points dans l'ordre
    - Marqueurs cliquables pour marquer la livraison effectuée au point
    - _Requirements: 10.1, 10.2, 10.4_
  - [~] 28.2 Créer la page tournées admin (`app/admin/tournees/page.tsx`)
    - Formulaire création tournée (créneau + date) — `POST /admin/tournees`
    - Liste des tournées filtrée par date/créneau
    - Vue détail tournée avec `DeliveryMap` et réordonnancement manuel (`PUT /admin/tournees/:id/ordre`)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 29. Back-office Admin — Journal Rotation (frontend)
  - [~] 29.1 Créer le composant `RotationLogTable` (`components/admin/RotationLogTable.tsx`) et la page journal (`app/admin/rotation-log/page.tsx`)
    - Tableau horodaté : date, statut (succès/échec), message d'erreur si échec
    - Indicateur d'alerte visible si la dernière rotation a échoué
    - Charger `GET /admin/rotation-logs`
    - _Requirements: 11.3, 11.4_

- [~] 30. Checkpoint final — tous les tests passent
  - Lancer `jest --runInBand` dans `apps/backend` — tous les tests property et unitaires passent
  - Lancer `vitest --run` dans `apps/frontend` — tous les tests composants passent
  - Vérifier que `tsc --noEmit` ne retourne aucune erreur dans `packages/shared`, `apps/backend`, `apps/frontend`
  - Corriger toute erreur avant de considérer l'implémentation terminée

## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être ignorées pour un MVP rapide
- Chaque tâche référence les requirements pour la traçabilité
- Les tests de propriété utilisent `fast-check` avec 100 itérations minimum (tag `// Feature: meal-ordering-app, Property N: <texte>`)
- Les tests unitaires utilisent `Jest` + `supertest` côté backend, `Vitest` + `Testing Library` côté frontend
- Toutes les routes backend sont sous le préfixe `/api/v1`
- Les images uploadées sont servies depuis `/uploads/plats/`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4"] },
    { "id": 6, "tasks": ["4.5", "5.1", "6.1", "7.1", "8.1"] },
    { "id": 7, "tasks": ["5.2", "5.3", "5.4", "5.5", "6.2", "6.3", "7.2", "7.3", "8.2", "8.3"] },
    { "id": 8, "tasks": ["9.1", "10.1", "13.1", "14.1"] },
    { "id": 9, "tasks": ["9.2", "9.3", "9.4", "9.5", "9.6", "10.2", "10.3", "10.4", "10.5", "11.1", "13.2", "14.2"] },
    { "id": 10, "tasks": ["11.2", "11.3", "12.1"] },
    { "id": 11, "tasks": ["12.2", "12.3"] },
    { "id": 12, "tasks": ["12.4", "16.1"] },
    { "id": 13, "tasks": ["16.2", "16.3"] },
    { "id": 14, "tasks": ["17.1"] },
    { "id": 15, "tasks": ["18.1", "18.2", "18.3"] },
    { "id": 16, "tasks": ["18.4", "19.1"] },
    { "id": 17, "tasks": ["19.2"] },
    { "id": 18, "tasks": ["19.3", "20.1", "20.2"] },
    { "id": 19, "tasks": ["21.1", "22.1", "23.1"] },
    { "id": 20, "tasks": ["24.1", "24.2", "25.1", "26.1"] },
    { "id": 21, "tasks": ["27.1", "28.1"] },
    { "id": 22, "tasks": ["28.2", "29.1"] }
  ]
}
```
