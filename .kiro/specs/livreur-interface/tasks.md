# Implementation Plan: Interface Livreur

## Overview

Implémentation du module livreur en monorepo TypeScript : migrations PostgreSQL, services backend, extension de l'authentification unifiée, routes API protégées par rôle, et interfaces Next.js pour l'admin (gestion livreurs + suivi missions) et le livreur (tableau de bord + progression). Les tâches suivent un ordre séquentiel strict — chaque couche s'appuie sur les précédentes.

## Tasks

- [ ] 1. Migration 014 — Table livreurs
  - [x] 1.1 Créer `apps/backend/src/db/migrations/014_create_livreurs.sql` avec la table `livreurs` (id UUID PK, login TEXT UNIQUE NOT NULL, nom TEXT NOT NULL, zone_habituelle TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL, actif BOOLEAN DEFAULT TRUE, created_at, updated_at) et les index sur `login`
    - _Requirements: 1.2_
  - [x] 1.2 Vérifier que la migration s'exécute sans erreur via `runMigrations()` et que la table est créée avec les contraintes attendues
    - _Requirements: 1.2_

- [x] 1. Migration 014 — Table livreurs

- [ ] 2. Migration 015 — Tables missions et mission_commandes
  - [x] 2.1 Créer `apps/backend/src/db/migrations/015_create_missions.sql` avec la table `missions` (id, livreur_id FK→livreurs, date_mission DATE, circuit TEXT, statut_mission TEXT CHECK IN ('en_attente','en_route','terminee','annulee') DEFAULT 'en_attente', started_at TIMESTAMPTZ nullable, completed_at TIMESTAMPTZ nullable, created_at, updated_at) et les index sur livreur_id, date_mission, statut_mission
    - _Requirements: 3.1, 5.1_
  - [x] 2.2 Ajouter dans la même migration la table `mission_commandes` (mission_id FK→missions ON DELETE CASCADE, commande_id FK→commandes ON DELETE RESTRICT, statut_livraison TEXT CHECK IN ('a_livrer','livre') DEFAULT 'a_livrer', PRIMARY KEY (mission_id, commande_id)) et l'index sur commande_id
    - _Requirements: 3.1, 5.3_
  - [x] 2.3 Vérifier que les deux tables sont créées, que les contraintes CHECK s'appliquent et que les foreign keys sont actives
    - _Requirements: 3.1_

- [x] 3. LivreurService — CRUD livreurs (partiel)
  - [x] 3.1 Créer `apps/backend/src/services/livreurService.ts` avec `createLivreur(input)`
    - _Requirements: 1.2, 1.3_
  - [x] 3.2 Implémenter `listLivreurs()` : retourner tous les livreurs triés par nom, sans `password_hash`
    - _Requirements: 1.7_
  - [x] 3.3 Implémenter `updateLivreur(id, input)` : PATCH partiel sur nom/zone_habituelle/actif uniquement (`updated_at = NOW()`), retourner l'enregistrement mis à jour — les champs non fournis restent inchangés
    - _Requirements: 1.4_
  - [x] 3.4 Implémenter `resetPassword(id)` : générer un mot de passe mémorisable aléatoire de 8 caractères (même pattern que `employeService`), hasher avec bcrypt 10 rounds, persister, invalider les sessions existantes, retourner `{ login, plainPassword }`
    - _Requirements: 1.5_
  - [x] 3.5 Implémenter `deactivateLivreur(id)` : set `actif = false` + `updated_at = NOW()` + `DELETE FROM sessions WHERE entity_id = id AND entity_type = 'livreur'`
    - _Requirements: 1.6_

- [ ] 4. LivreurService — CRUD missions
  - [x] 4.1 Implémenter `createMission(input)` dans une transaction
    - _Requirements: 3.1, 3.2_
  - [x] 4.2 Implémenter `getMissionsToday(livreurId?)`
    - _Requirements: 4.1, 4.2, 6.1, 6.2_
  - [x] 4.3 Implémenter `getMission(id)` : même jointure que ci-dessus sans filtre date, lancer `RESOURCE_NOT_FOUND` si absent
    - _Requirements: 4.2_
  - [x] 4.4 Implémenter `updateMission(id, input)`
    - _Requirements: 3.3, 3.4_
  - [x] 4.5 Implémenter `cancelMission(id)`
    - _Requirements: 3.5, 3.6_

- [ ] 5. LivreurService — progression de mission
  - [x] 5.1 Implémenter `startMission(missionId, livreurId)`
    - _Requirements: 5.1, 5.2_
  - [x] 5.2 Implémenter `markCommandeLivree(missionId, commandeId, livreurId)`
    - _Requirements: 5.3_
  - [x] 5.3 Implémenter `completeMission(missionId, livreurId)` dans une transaction
    - _Requirements: 5.5, 5.6, 5.7_

- [x] 6. LivreurService — historique paginé
  - [x] 6.1 Implémenter `getHistorique(livreurId, page)`
    - _Requirements: 8.1, 8.2, 8.4_

- [ ] 7. Étendre AuthService — login livreur
  - [x] 7.1 Ajouter le type `'livreur'` à `TokenPayload.role` et `AuthTokens.role`
    - _Requirements: 2.2_
  - [x] 7.2 Créer `AuthService.loginLivreur(login, password)`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 7.3 Modifier la route `POST /auth/unified-login` dans `routes/auth.ts` : après l'échec de `loginAdmin` et `loginStructure`, tenter `loginLivreur` ; inclure `redirectTo: '/livreur/dashboard'` dans la réponse JSON si `role === 'livreur'`
    - _Requirements: 2.1, 2.4_

- [x] 8. Middleware auth — requireLivreur et livreurScope
  - [x] 8.1 Ajouter `livreurId?: string` à `Express.Request` et ajouter `'livreur'` au type union de `role`
    - _Requirements: 9.1, 9.2_
  - [x] 8.2 Modifier `authenticate` dans `middleware/auth.ts` pour setter `req.livreurId = payload.entityId` quand `role === 'livreur'`
    - _Requirements: 9.2, 9.3_
  - [x] 8.3 Créer `requireLivreur(req, res, next)`
    - _Requirements: 9.2_
  - [x] 8.4 Créer `livreurScope(req, res, next)`
    - _Requirements: 9.3, 9.4_

- [ ] 9. Routes admin livreurs (`routes/admin/livreurs.ts`)
  - [x] 9.1 Créer le router avec `authenticate` + `requireAdmin` en middleware global
    - _Requirements: 9.1_
  - [x] 9.2 Implémenter `GET /admin/livreurs` → `LivreurService.listLivreurs()`
    - _Requirements: 1.7_
  - [x] 9.3 Implémenter `POST /admin/livreurs` avec validation Zod
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 9.4 Implémenter `PATCH /admin/livreurs/:id` avec validation Zod
    - _Requirements: 1.4_
  - [x] 9.5 Implémenter `POST /admin/livreurs/:id/reset-password`
    - _Requirements: 1.5_
  - [x] 9.6 Implémenter `POST /admin/livreurs/:id/deactivate`
    - _Requirements: 1.6_

- [x] 10. Routes admin missions (`routes/admin/missions.ts`)
  - [x] 10.1 Créer le router avec `authenticate` + `requireAdmin`
    - _Requirements: 9.1_
  - [x] 10.2 Implémenter `GET /admin/missions?date=YYYY-MM-DD`
    - _Requirements: 3.7, 6.1, 6.2_
  - [x] 10.3 Implémenter `POST /admin/missions` avec validation Zod
    - _Requirements: 3.1, 3.2_
  - [x] 10.4 Implémenter `PATCH /admin/missions/:id` avec validation Zod
    - _Requirements: 3.3, 3.4_
  - [x] 10.5 Implémenter `POST /admin/missions/:id/cancel`
    - _Requirements: 3.5, 3.6_
  - [x] 10.6 Implémenter `GET /admin/missions/commandes-par-zone?date=YYYY-MM-DD`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 11. Routes livreur (`routes/livreur.ts`)
  - [x] 11.1 Créer le router avec `authenticate` + `requireLivreur`
    - _Requirements: 9.2_
  - [x] 11.2 Implémenter `GET /livreur/missions/today`
    - _Requirements: 4.1, 4.2, 2.5_
  - [x] 11.3 Implémenter `GET /livreur/missions/historique?page=1`
    - _Requirements: 8.1, 8.2, 8.4_
  - [x] 11.4 Implémenter `POST /livreur/missions/:id/start`
    - _Requirements: 5.1, 5.2, 9.3_
  - [x] 11.5 Implémenter `POST /livreur/missions/:id/commandes/:commandeId/livre`
    - _Requirements: 5.3, 9.3_
  - [x] 11.6 Implémenter `POST /livreur/missions/:id/complete`
    - _Requirements: 5.5, 5.6, 5.7, 9.3_

- [x] 12. Enregistrement des routes dans `index.ts`
  - [x] 12.1 Importer les trois routers
    - _Requirements: 9.1, 9.2_
  - [x] 12.2 Enregistrer les trois routes
    - _Requirements: 9.1, 9.2_

- [ ] 13. Page admin livreurs (`app/admin/livreurs/page.tsx`)
  - [ ] 13.1 Créer la page avec un tableau listant tous les livreurs (colonnes : login, nom, zone_habituelle, actif, actions), données chargées via `GET /api/v1/admin/livreurs`
    - _Requirements: 1.7_
  - [ ] 13.2 Ajouter un formulaire (modal ou panel inline) de création de livreur avec les champs login, mot de passe, nom, zone_habituelle et gestion d'erreur `LIVREUR_LOGIN_DUPLICATE`
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 13.3 Implémenter l'action "Modifier" (PATCH) pour nom et zone_habituelle directement depuis le tableau (édition inline ou drawer)
    - _Requirements: 1.4_
  - [ ] 13.4 Implémenter l'action "Réinitialiser mot de passe" : afficher le mot de passe en clair dans une modale one-shot avec le message "Ce mot de passe ne sera plus affiché" — fermer la modale efface définitivement l'information
    - _Requirements: 1.5_
  - [ ] 13.5 Implémenter l'action "Désactiver / Réactiver" (toggle actif) avec confirmation pour la désactivation
    - _Requirements: 1.6_

- [ ] 14. Page admin missions (`app/admin/missions/page.tsx`)
  - [ ] 14.1 Créer la page avec trois onglets : "Créer une mission", "Suivi du jour", "Commandes par zone"
    - _Requirements: 3.7, 6.1, 7.1_
  - [ ] 14.2 Onglet "Créer une mission" : formulaire de sélection du livreur (dropdown peuplé depuis `GET /admin/livreurs`), saisie du circuit (texte libre), date de mission (défaut : aujourd'hui), sélection des commandes à assigner (liste des commandes du jour filtrables par structure)
    - _Requirements: 3.1, 3.2_
  - [ ] 14.3 Onglet "Suivi du jour" : liste des missions du jour groupées par livreur, affichant circuit, statut_mission (badge coloré), compteur livré/total, horodatage started_at ; dropdown de filtre par statut_mission (tous / en_attente / en_route / terminee / annulee) ; bouton "Annuler" par mission si statut ≠ terminee ; rafraîchissement automatique toutes les 30 secondes via `setInterval`
    - _Requirements: 3.5, 3.6, 6.1, 6.2, 6.3, 6.4_
  - [ ] 14.4 Onglet "Commandes par zone" : sélecteur de date, message "Aucune mission planifiée pour cette date" si vide, sinon liste groupée par circuit avec nom structure, creneau, montant_total, statut commande ; filtre par statut de commande
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 15. Page livreur dashboard (`app/livreur/dashboard/page.tsx`)
  - [ ] 15.1 Créer la page protégée par vérification du rôle `livreur` dans le JWT — rediriger vers `/login` si non authentifié ou rôle incorrect
    - _Requirements: 2.4, 2.5, 9.2_
  - [ ] 15.2 Section "Aujourd'hui" : charger `GET /api/v1/livreur/missions/today`, afficher chaque mission avec circuit, statut_mission, et pour chaque commande : nom de la structure, adresse GPS, creneau
    - _Requirements: 4.1, 4.2_
  - [ ] 15.3 Bouton "En route" visible et actif uniquement pour les missions avec `statut_mission = 'en_attente'` — appel `POST .../start` au clic
    - _Requirements: 5.1, 5.2_
  - [ ] 15.4 Pour les missions `en_route` : bouton "Livré" par commande avec `statut_livraison = 'a_livrer'` (appel `POST .../commandes/:id/livre`) ; bouton "Terminer la mission" actif uniquement quand toutes les commandes ont `statut_livraison = 'livre'` (appel `POST .../complete`)
    - _Requirements: 5.3, 5.4, 5.5_
  - [ ] 15.5 Pour les missions avec `statut_mission = 'annulee'` : afficher le badge "Annulée" avec style visuel distinct (grisé ou rayé) et désactiver tous les boutons d'action
    - _Requirements: 4.3, 8.3_
  - [ ] 15.6 Implémenter le rafraîchissement automatique toutes les 30 secondes via `setInterval` avec nettoyage `clearInterval` au démontage du composant
    - _Requirements: 4.4_
  - [ ] 15.7 Section "Historique" : charger `GET /api/v1/livreur/missions/historique?page=1`, afficher date_mission, circuit, statut_mission, livré/total, started_at, completed_at ; pagination avec boutons "Précédent" / "Suivant" en fonction du total retourné
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 16. Mise à jour du dashboard admin (`app/admin/page.tsx`)
  - [ ] 16.1 Ajouter `{ href: '/admin/livreurs', label: 'Livreurs' }` et `{ href: '/admin/missions', label: 'Missions' }` dans le tableau `navLinks` du composant `AdminDashboard`
    - _Requirements: 1.7, 3.7_

- [ ] 17. Mise à jour de la page de login frontend
  - [ ] 17.1 Modifier le handler de succès du login unifié dans le frontend : si `role === 'livreur'` dans la réponse, naviguer vers `/livreur/dashboard` via `router.push` ; conserver le comportement existant pour les autres rôles (admin → `/admin`, structure/employé → tableau de bord existant)
    - _Requirements: 2.4_

## Notes

- Les tests de propriété (P1-P21) utilisent `fast-check` avec 100 itérations minimum — tag format : `// Feature: livreur-interface, Property N: <texte>`
- Toutes les routes backend sont sous le préfixe `/api/v1`
- L'`entity_type = 'livreur'` dans la table `sessions` existante ne nécessite pas de migration — le champ est déjà TEXT libre
- Le rafraîchissement du dashboard livreur et du suivi admin se fait par polling (setInterval 30s) sans SSE dédié pour cette fonctionnalité
- Les mots de passe livreur utilisent le même générateur mémorisable que les employés (mot du lexique + 2 chiffres)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3", "3.4", "3.5"] },
    { "id": 5, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 6, "tasks": ["4.4", "4.5"] },
    { "id": 7, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 8, "tasks": ["6.1"] },
    { "id": 9, "tasks": ["7.1", "7.2"] },
    { "id": 10, "tasks": ["7.3", "8.1"] },
    { "id": 11, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 12, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6"] },
    { "id": 13, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6"] },
    { "id": 14, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6"] },
    { "id": 15, "tasks": ["12.1", "12.2"] },
    { "id": 16, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5"] },
    { "id": 17, "tasks": ["14.1", "14.2", "14.3", "14.4"] },
    { "id": 18, "tasks": ["15.1", "15.2", "15.3", "15.4", "15.5", "15.6", "15.7"] },
    { "id": 19, "tasks": ["16.1", "17.1"] }
  ]
}
```
