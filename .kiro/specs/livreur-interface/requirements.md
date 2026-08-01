# Requirements Document

## Introduction

Cette fonctionnalité introduit une interface dédiée aux livreurs dans l'application resto-money.
L'administrateur crée et gère des comptes livreurs distincts des employés de structure, leur assigne des missions journalières (listes de commandes groupées par circuit/zone), et suit leur avancement en temps réel. Le livreur accède à l'application via la page `/login` unifiée existante avec le rôle `livreur`, consulte ses missions du jour, et met à jour l'état de chaque livraison au fil de sa tournée.

---

## Glossary

- **Admin** : Utilisateur authentifié avec le rôle `admin`, responsable de la configuration et du suivi opérationnel.
- **Livreur** : Utilisateur authentifié avec le rôle `livreur`, disposant d'un compte dans la table `livreurs`, chargé d'exécuter des missions de livraison.
- **Mission** : Ensemble de commandes assignées à un Livreur pour une date donnée, regroupées sous un intitulé de circuit/zone.
- **Circuit** : Intitulé textuel décrivant la zone géographique ou la tournée couverte par une Mission (ex. "Zone Nord", "Circuit A").
- **Commande** : Enregistrement existant dans la table `commandes`, identifié par `id`, rattaché à une `structure_id` et possédant un `statut`.
- **Statut_Mission** : État d'avancement d'une Mission — valeurs possibles : `en_attente`, `en_route`, `terminee`, `annulee`.
- **Statut_Livraison** : État d'avancement d'une ligne de livraison individuelle au sein d'une Mission — valeurs possibles : `a_livrer`, `livre`.
- **Unified_Login** : Point d'entrée d'authentification unique `/auth/unified-login` déjà en place, capable de résoudre plusieurs rôles.
- **AuthService** : Service backend gérant la génération et la validation des tokens JWT pour tous les rôles.
- **LivreurService** : Service backend responsable de la logique métier liée aux Livreurs et aux Missions.
- **Admin_Dashboard** : Interface frontend réservée à l'Admin pour la gestion des Livreurs et des Missions.
- **Livreur_Dashboard** : Interface frontend réservée au Livreur pour consulter et faire avancer ses Missions.

---

## Requirements

### Requirement 1: Gestion des comptes Livreurs par l'Admin

**User Story:** En tant qu'Admin, je veux créer, modifier et désactiver des comptes Livreurs, afin de contrôler qui peut accéder à l'interface de livraison.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL afficher un formulaire permettant de saisir le `login`, le `mot de passe`, le `nom` et la `zone_habituelle` lors de la création d'un Livreur.
2. WHEN l'Admin soumet le formulaire de création d'un Livreur avec des données valides, THE LivreurService SHALL créer un enregistrement dans la table `livreurs` avec le `password_hash` calculé via bcrypt (10 rounds).
3. IF le `login` fourni existe déjà dans la table `livreurs`, THEN THE LivreurService SHALL retourner une erreur avec le code `LIVREUR_LOGIN_DUPLICATE`.
4. WHEN l'Admin soumet une modification de compte Livreur, THE LivreurService SHALL mettre à jour les champs modifiés (`nom`, `zone_habituelle`, `actif`) sans altérer les champs non inclus dans la requête.
5. WHEN l'Admin réinitialise le mot de passe d'un Livreur, THE LivreurService SHALL générer un nouveau mot de passe aléatoire mémorisable de 8 caractères, mettre à jour le `password_hash` et retourner le mot de passe en clair une seule fois.
6. WHEN l'Admin désactive un Livreur (`actif = false`), THE LivreurService SHALL invalider toutes les sessions actives de ce Livreur dans la table `sessions`.
7. THE Admin_Dashboard SHALL afficher la liste de tous les Livreurs avec leur `login`, `nom`, `zone_habituelle` et statut `actif`.

---

### Requirement 2: Authentification du Livreur via le login unifié

**User Story:** En tant que Livreur, je veux me connecter via la page `/login` unifiée avec mon login et mot de passe, afin d'accéder à mon interface de missions sans avoir besoin d'une URL différente.

#### Acceptance Criteria

1. WHEN un Livreur soumet ses identifiants sur `/auth/unified-login`, THE AuthService SHALL rechercher le `login` dans la table `livreurs` après avoir échoué la résolution admin et employé.
2. WHEN les identifiants du Livreur sont valides et que son compte est `actif`, THE AuthService SHALL générer un JWT avec le rôle `livreur` et l'`entityId` correspondant à l'`id` de l'enregistrement dans `livreurs`.
3. IF le compte Livreur a `actif = false`, THEN THE AuthService SHALL retourner une erreur avec le code `AUTH_INVALID_CREDENTIALS` sans distinguer si le compte existe ou si le mot de passe est incorrect.
4. WHEN l'authentification du Livreur réussit, THE Unified_Login SHALL rediriger le navigateur vers `/livreur/dashboard`.
5. WHILE un Livreur est authentifié, THE Livreur_Dashboard SHALL afficher exclusivement les données relatives à ce Livreur, sans exposer de données appartenant à d'autres Livreurs ou à des structures.

---

### Requirement 3: Création et gestion des Missions par l'Admin

**User Story:** En tant qu'Admin, je veux créer des missions en assignant une liste de commandes à un Livreur pour une date et un circuit donnés, afin d'organiser les tournées journalières.

#### Acceptance Criteria

1. WHEN l'Admin crée une Mission, THE LivreurService SHALL persister l'entité Mission avec les champs `livreur_id`, `date_mission`, `circuit` (intitulé textuel), `statut_mission = 'en_attente'` et la liste des `commande_id` associées.
2. IF une `commande_id` fournie lors de la création de Mission n'existe pas dans la table `commandes`, THEN THE LivreurService SHALL retourner une erreur avec le code `MISSION_COMMANDE_NOT_FOUND`.
3. WHEN l'Admin modifie une Mission dont le `statut_mission` est `en_attente`, THE LivreurService SHALL permettre la modification du `circuit`, de la `date_mission` et de la liste des commandes associées.
4. IF l'Admin tente de modifier une Mission dont le `statut_mission` est `terminee`, THEN THE LivreurService SHALL retourner une erreur avec le code `MISSION_ALREADY_COMPLETED`.
5. WHEN l'Admin annule une Mission, THE LivreurService SHALL passer son `statut_mission` à `annulee` quelle que soit la valeur actuelle du statut, sauf si `statut_mission = 'terminee'`.
6. IF l'Admin tente d'annuler une Mission avec `statut_mission = 'terminee'`, THEN THE LivreurService SHALL retourner une erreur avec le code `MISSION_ALREADY_COMPLETED`.
7. THE Admin_Dashboard SHALL afficher les Missions du jour groupées par Livreur, avec le `circuit`, le `statut_mission` et le nombre de livraisons effectuées sur le nombre total de commandes de la Mission.

---

### Requirement 4: Vue des missions du jour par le Livreur

**User Story:** En tant que Livreur, je veux voir mes missions du jour avec la liste des commandes et adresses à livrer, afin de préparer et exécuter ma tournée efficacement.

#### Acceptance Criteria

1. WHEN un Livreur authentifié accède à `/livreur/dashboard`, THE Livreur_Dashboard SHALL afficher uniquement les Missions dont `livreur_id` correspond à l'utilisateur connecté et `date_mission = date du jour`.
2. THE Livreur_Dashboard SHALL afficher pour chaque Mission : l'intitulé du `circuit`, le `statut_mission`, et pour chaque commande associée : le nom de la structure (`structures.nom`), l'adresse ou les coordonnées GPS (`structures.latitude`, `structures.longitude`) et le `creneau` de livraison.
3. WHILE le `statut_mission` d'une Mission est `annulee`, THE Livreur_Dashboard SHALL afficher la Mission avec un indicateur visuel `Annulée` et SHALL empêcher toute action de progression dessus.
4. THE Livreur_Dashboard SHALL rafraîchir l'affichage des Missions du jour sans rechargement complet de page à un intervalle maximum de 30 secondes ou lors d'une action de l'utilisateur.

---

### Requirement 5: Progression d'une Mission par le Livreur

**User Story:** En tant que Livreur, je veux marquer l'avancement de ma mission étape par étape (En route → livraisons individuelles → Terminée), afin que l'Admin puisse suivre l'état de chaque tournée en temps réel.

#### Acceptance Criteria

1. WHEN un Livreur clique sur "En route" pour une Mission dont `statut_mission = 'en_attente'`, THE LivreurService SHALL passer le `statut_mission` à `en_route` et enregistrer l'horodatage dans `started_at`.
2. IF un Livreur tente de passer une Mission à `en_route` alors que son `statut_mission` n'est pas `en_attente`, THEN THE LivreurService SHALL retourner une erreur avec le code `MISSION_INVALID_TRANSITION`.
3. WHILE le `statut_mission` d'une Mission est `en_route`, THE Livreur_Dashboard SHALL permettre au Livreur de marquer individuellement chaque commande comme `livre` en changeant son `Statut_Livraison` de `a_livrer` à `livre`.
4. WHEN toutes les commandes d'une Mission ont le `Statut_Livraison = 'livre'`, THE Livreur_Dashboard SHALL activer le bouton "Terminer la mission".
5. WHEN un Livreur clique sur "Terminer la mission" pour une Mission dont `statut_mission = 'en_route'`, THE LivreurService SHALL passer le `statut_mission` à `terminee` et enregistrer l'horodatage dans `completed_at`.
6. IF un Livreur tente de terminer une Mission alors que le `statut_mission` n'est pas `en_route`, THEN THE LivreurService SHALL retourner une erreur avec le code `MISSION_INVALID_TRANSITION`.
7. WHEN le `statut_mission` passe à `terminee`, THE LivreurService SHALL mettre à jour le `statut` des commandes associées dans la table `commandes` à la valeur `livre`.

---

### Requirement 6: Suivi des missions en temps réel par l'Admin

**User Story:** En tant qu'Admin, je veux voir l'avancement de toutes les missions du jour livreur par livreur, afin de détecter rapidement les retards et d'intervenir si nécessaire.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL afficher une vue "Suivi du jour" listant toutes les Missions dont `date_mission = date du jour`, groupées par Livreur.
2. THE Admin_Dashboard SHALL afficher pour chaque Mission : le `circuit`, le `statut_mission`, le nombre de commandes avec `Statut_Livraison = 'livre'` sur le total, l'horodatage `started_at` si disponible.
3. WHEN le `statut_mission` d'une Mission change, THE Admin_Dashboard SHALL refléter le nouveau statut dans un délai maximum de 30 secondes sans rechargement complet de page.
4. THE Admin_Dashboard SHALL permettre à l'Admin de filtrer la vue "Suivi du jour" par `Statut_Mission` (tous, en_attente, en_route, terminee, annulee).

---

### Requirement 7: Vue des commandes par zone/circuit pour la préparation des tournées

**User Story:** En tant qu'Admin, je veux consulter la liste des commandes regroupées par zone/circuit, afin de préparer et vérifier le contenu des tournées avant de les assigner.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL proposer une vue "Commandes par zone" permettant de sélectionner une `date_mission` et d'afficher les commandes groupées par `circuit` des Missions existantes pour cette date.
2. WHEN aucune Mission n'existe pour la date sélectionnée, THE Admin_Dashboard SHALL afficher un état vide avec le message "Aucune mission planifiée pour cette date".
3. THE Admin_Dashboard SHALL afficher pour chaque commande dans la vue par zone : le nom de la structure, le `creneau`, le `montant_total` et le `statut` courant de la commande dans la table `commandes`.
4. THE Admin_Dashboard SHALL permettre à l'Admin de filtrer les commandes de la vue par zone par `statut` de commande (`en_attente`, `en_livraison`, `livre`).

---

### Requirement 8: Historique des missions pour le Livreur

**User Story:** En tant que Livreur, je veux consulter l'historique de mes missions passées, afin de vérifier les livraisons effectuées et les circuits déjà effectués.

#### Acceptance Criteria

1. WHEN un Livreur authentifié accède à la section "Historique", THE Livreur_Dashboard SHALL afficher toutes ses Missions dont `date_mission < date du jour`, triées par `date_mission` décroissante.
2. THE Livreur_Dashboard SHALL afficher pour chaque Mission historique : la `date_mission`, le `circuit`, le `statut_mission`, le nombre de commandes livrées sur le total et les horodatages `started_at` et `completed_at` lorsqu'ils sont disponibles.
3. IF le `statut_mission` d'une Mission historique est `annulee`, THEN THE Livreur_Dashboard SHALL afficher la Mission avec un indicateur visuel `Annulée` et SHALL empêcher toute action dessus.
4. THE LivreurService SHALL paginer les résultats de l'historique par tranches de 20 Missions maximum par page.

---

### Requirement 9: Sécurité et contrôle d'accès

**User Story:** En tant qu'Admin, je veux que les routes livreurs soient protégées par rôle, afin qu'un Livreur ne puisse pas accéder aux données administratives et vice-versa.

#### Acceptance Criteria

1. THE AuthService SHALL rejeter avec le code HTTP 403 toute requête sur les routes `/admin/livreurs/*` dont le JWT ne contient pas le rôle `admin`.
2. THE AuthService SHALL rejeter avec le code HTTP 403 toute requête sur les routes `/livreur/*` dont le JWT ne contient pas le rôle `livreur`.
3. WHEN un Livreur envoie une requête sur une route `/livreur/*`, THE LivreurService SHALL vérifier que le `livreur_id` dans les paramètres ou le corps de la requête correspond à l'`entityId` du JWT avant d'exécuter l'opération.
4. IF la vérification d'identité échoue, THEN THE LivreurService SHALL retourner une erreur avec le code HTTP 403 sans révéler les données d'un autre Livreur.
5. THE AuthService SHALL expirer les access tokens des Livreurs après 15 minutes, identique aux autres rôles, et permettre le renouvellement via `/auth/refresh` avec le refresh token httpOnly cookie.
