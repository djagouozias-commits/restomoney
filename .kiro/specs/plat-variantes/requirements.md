# Requirements Document

## Introduction

Cette fonctionnalité ajoute la gestion des variantes de prix sur les plats de l'application resto-money. Actuellement, chaque plat possède un unique champ `prix`. L'objectif est de permettre à chaque plat de disposer d'une ou plusieurs variantes, chacune associée à un prix et un libellé descriptif (ex. : "Standard", "Standard + 2 saucisses", "Star + aileron + 2 saucisses"). La migration est rétrocompatible : le champ `prix` actuel de la table `plats` devient le prix de la variante par défaut. Quand un plat ne possède qu'une seule variante, le comportement existant est conservé (ajout direct au panier, sans sélection forcée).

## Glossary

- **Plat** : Entrée dans la table `plats`.
- **Variante** : Combinaison (libellé, prix) associée à un Plat (1 à N variantes par plat).
- **Variante_par_defaut** : Première Variante créée automatiquement lors de la migration, héritant du champ `prix` du Plat.
- **Ligne_Commande** : Article dans la table `lignes_commande`.
- **Panier** : État client côté frontend avant soumission de la commande.
- **API_Admin** : Routes `/api/v1/admin/plats` accessibles par l'administrateur.
- **API_Employe** : Route `/api/v1/creneaux/plats-du-jour` utilisée par les employés.
- **Page_Admin_Plats** : Page Next.js de gestion des plats dans le back-office admin.
- **Page_Commande** : Page Next.js de passation de commande côté employé.
- **Systeme** : Back-end Node.js/TypeScript + Express + PostgreSQL.
- **Migration** : Script SQL exécuté automatiquement au démarrage du serveur.

## Requirements

### Requirement 1: Modèle de données des variantes

**User Story:** En tant qu'administrateur, je veux que chaque plat puisse avoir plusieurs variantes de prix stockées en base, afin de pouvoir proposer des formules différentes pour un même plat.

#### Acceptance Criteria

1. THE Systeme SHALL fournir une table `plat_variantes` avec les colonnes `id UUID PRIMARY KEY`, `plat_id UUID NOT NULL REFERENCES plats(id) ON DELETE CASCADE`, `libelle TEXT NOT NULL`, `prix NUMERIC(10,2) NOT NULL CHECK (prix > 0)`, `position SMALLINT NOT NULL DEFAULT 1`, `created_at TIMESTAMPTZ DEFAULT NOW()`.
2. THE Systeme SHALL garantir que `(plat_id, position)` est une contrainte UNIQUE dans la table `plat_variantes`.
3. THE Systeme SHALL créer un index sur `plat_variantes(plat_id)` pour les requêtes de listing par plat.
4. WHEN la Migration est exécutée sur une base existante, THE Systeme SHALL insérer une Variante_par_defaut pour chaque Plat existant en copiant la valeur du champ `prix` et en assignant le libellé "Standard" et la position 1.
5. WHEN la Migration est exécutée sur une base existante, THE Systeme SHALL conserver le champ `prix` dans la table `plats` pour la rétrocompatibilité, en le maintenant synchronisé avec le prix de la Variante à position 1.

### Requirement 2: Contrainte minimum une variante par plat

**User Story:** En tant qu'administrateur, je veux qu'un plat ait toujours au moins une variante, afin d'éviter les plats sans prix.

#### Acceptance Criteria

1. WHEN une requête tente de supprimer la dernière Variante d'un Plat, THE API_Admin SHALL retourner une erreur HTTP 409 avec le code LAST_VARIANTE_ERROR.
2. WHEN un Plat est créé sans variante explicite, THE API_Admin SHALL créer automatiquement une Variante_par_defaut à partir du champ `prix` fourni avec le libellé "Standard".
3. THE Systeme SHALL garantir qu'aucun Plat dans la base de données ne possède zéro Variante.

### Requirement 3: API CRUD des variantes

**User Story:** En tant qu'administrateur, je veux gérer les variantes de prix d'un plat via l'API, afin de maintenir à jour les offres disponibles.

#### Acceptance Criteria

1. WHEN une requête GET `/api/v1/admin/plats/:id/variantes` est reçue, THE API_Admin SHALL retourner la liste des Variantes du Plat triées par `position` croissante, avec les champs `id`, `libelle`, `prix`, `position`.
2. WHEN une requête POST `/api/v1/admin/plats/:id/variantes` est reçue avec un corps JSON valide contenant `libelle` (string, min 1, max 255) et `prix` (number positif), THE API_Admin SHALL créer la Variante et retourner HTTP 201 avec la ressource créée.
3. WHEN une requête PUT `/api/v1/admin/plats/:id/variantes/:varianteId` est reçue avec un corps JSON valide, THE API_Admin SHALL mettre à jour le `libelle` et/ou le `prix` de la Variante et retourner la ressource mise à jour.
4. WHEN une requête DELETE `/api/v1/admin/plats/:id/variantes/:varianteId` est reçue et que le Plat possède plus d'une Variante, THE API_Admin SHALL supprimer la Variante et retourner HTTP 200.
5. WHEN une requête PUT ou DELETE cible une Variante inexistante ou n'appartenant pas au Plat indiqué, THE API_Admin SHALL retourner HTTP 404 avec le code RESOURCE_NOT_FOUND.
6. WHEN un corps de requête POST ou PUT sur les variantes contient un `prix` inférieur ou égal à 0 ou un `libelle` vide, THE API_Admin SHALL retourner HTTP 422 avec le code VALIDATION_ERROR.
7. WHEN la Variante à position 1 d'un Plat est modifiée, THE Systeme SHALL mettre à jour le champ `prix` de la table `plats` avec le nouveau prix de cette Variante, sauf si une logique métier explicite justifie de conserver une valeur différente.

### Requirement 4: Listing admin enrichi avec variantes

**User Story:** En tant qu'administrateur, je veux que le listing des plats retourne les variantes associées, afin de les afficher directement dans l'interface de gestion.

#### Acceptance Criteria

1. WHEN une requête GET `/api/v1/admin/plats` est reçue, THE API_Admin SHALL retourner chaque Plat avec une propriété `variantes` contenant la liste des Variantes triées par `position` croissante.
2. WHEN une requête GET `/api/v1/admin/plats` est reçue, THE API_Admin SHALL retourner pour chaque Variante les champs `id`, `libelle`, `prix`, `position`.
3. THE API_Admin SHALL retourner les résultats de GET `/api/v1/admin/plats` en effectuant au maximum une requête SQL supplémentaire par rapport au listing actuel.

### Requirement 5: API employé plats du jour avec variantes

**User Story:** En tant qu'employé, je veux que les plats du jour retournés par l'API incluent les variantes, afin de les afficher sur la page de commande.

#### Acceptance Criteria

1. WHEN une requête GET `/api/v1/menus/du-jour` est reçue, THE API_Employe SHALL retourner chaque Plat avec une propriété `variantes` contenant la liste des Variantes triées par `position` croissante, avec les champs `id`, `libelle`, `prix`.
2. WHILE un Plat ne possède qu'une seule Variante, THE API_Employe SHALL continuer à exposer le champ `prix` au niveau du Plat pour garantir la rétrocompatibilité.

### Requirement 6: Traitement variante lors de la création de commande

**User Story:** En tant qu'employé, je veux pouvoir sélectionner une variante lors de l'ajout d'un plat au panier, afin que le bon prix soit enregistré dans la commande.

#### Acceptance Criteria

1. WHEN une requête POST `/api/v1/commandes` est reçue avec une ligne de type `plat` contenant un champ `variante_id`, THE Systeme SHALL vérifier que la Variante appartient bien au Plat référencé dans `plat_id`.
2. WHEN la Variante est valide, THE Systeme SHALL stocker le `prix` de la Variante dans le champ `prix_unitaire` de la Ligne_Commande correspondante.
3. WHEN une requête POST `/api/v1/commandes` est reçue avec une ligne de type `plat` sans `variante_id` et que le Plat possède plus d'une Variante, THE Systeme SHALL retourner HTTP 422 avec le code VARIANTE_REQUIRED.
4. WHEN une requête POST `/api/v1/commandes` est reçue avec une ligne de type `plat` sans `variante_id` et que le Plat ne possède qu'une seule Variante, THE Systeme SHALL utiliser automatiquement le prix de cette unique Variante comme `prix_unitaire`.
5. WHEN une Ligne_Commande de type `plat` est insérée lors du traitement d'une requête POST `/api/v1/commandes`, THE Systeme SHALL stocker l'identifiant de la Variante dans une colonne `variante_id UUID REFERENCES plat_variantes(id)` de la table `lignes_commande`.
6. WHEN une requête GET `/api/v1/commandes/:id` est reçue, THE Systeme SHALL retourner pour chaque ligne de type `plat` les champs `variante_id`, `variante_libelle` et `prix_unitaire`.

### Requirement 7: Interface admin gestion des variantes

**User Story:** En tant qu'administrateur, je veux gérer les variantes directement depuis la page de gestion des plats, afin d'ajouter, modifier ou supprimer des variantes sans quitter l'interface.

#### Acceptance Criteria

1. WHEN la Page_Admin_Plats est chargée, THE Page_Admin_Plats SHALL afficher pour chaque Plat la liste de ses Variantes sous forme de lignes éditables contenant le libellé et le prix.
2. WHEN l'administrateur clique sur "Ajouter une variante" pour un Plat, THE Page_Admin_Plats SHALL afficher un formulaire inline avec les champs `libelle` et `prix` et un bouton de validation.
3. WHEN l'administrateur soumet le formulaire d'ajout avec des données valides, THE Page_Admin_Plats SHALL appeler POST `/api/v1/admin/plats/:id/variantes` et mettre à jour la liste des variantes affichées sans rechargement de page.
4. WHEN l'administrateur modifie le libellé ou le prix d'une Variante existante et confirme, THE Page_Admin_Plats SHALL mettre à jour immédiatement l'affichage avec les nouvelles valeurs puis appeler PUT `/api/v1/admin/plats/:id/variantes/:varianteId`.
5. WHEN l'administrateur clique sur "Supprimer" pour une Variante et que le Plat possède plus d'une Variante, THE Page_Admin_Plats SHALL appeler DELETE `/api/v1/admin/plats/:id/variantes/:varianteId` et retirer la Variante de l'affichage.
6. WHEN l'administrateur tente de supprimer la dernière Variante d'un Plat, THE Page_Admin_Plats SHALL afficher un message d'erreur indiquant qu'un Plat doit conserver au moins une Variante, sans émettre de requête DELETE.
7. WHEN une réponse d'erreur de l'API est reçue lors d'une opération sur les variantes, THE Page_Admin_Plats SHALL afficher un message d'erreur lisible à l'utilisateur.

### Requirement 8: Interface employé sélection de variante

**User Story:** En tant qu'employé, je veux voir les variantes d'un plat sur sa carte et en sélectionner une avant d'ajouter au panier, afin de commander la bonne formule au bon prix.

#### Acceptance Criteria

1. WHILE un Plat possède plus d'une Variante, THE Page_Commande SHALL afficher sous la description du Plat une liste de boutons de sélection, un par Variante, avec le format "{prix} FCFA - {libellé}".
2. WHILE un Plat ne possède qu'une seule Variante, THE Page_Commande SHALL conserver le comportement actuel : affichage du prix unique et bouton "+ Ajouter" direct, sans sélection obligatoire.
3. WHEN l'employé sélectionne une Variante, THE Page_Commande SHALL mettre en surbrillance le bouton de la Variante sélectionnée et activer le bouton "+ Ajouter".
4. WHEN l'employé clique sur "+ Ajouter" après avoir sélectionné une Variante, THE Page_Commande SHALL ajouter au Panier un article avec le prix de la Variante sélectionnée, son libellé et l'identifiant `variante_id`.
5. WHILE aucune Variante n'est sélectionnée pour un Plat multi-variantes, THE Page_Commande SHALL désactiver le bouton "+ Ajouter". Le bouton peut être réactivé par la sélection d'une Variante ou par d'autres interactions UI standard.
6. WHEN un article est ajouté au Panier avec une Variante, THE Page_Commande SHALL afficher dans le Panier le nom du Plat, le libellé de la Variante et le prix unitaire correspondant.

### Requirement 9: Soumission de commande avec variante

**User Story:** En tant qu'employé, je veux que la variante sélectionnée soit transmise lors de la soumission de la commande, afin que le bon prix soit enregistré côté serveur.

#### Acceptance Criteria

1. WHEN l'employé soumet le Panier, THE Page_Commande SHALL inclure dans chaque ligne de type `plat` le champ `variante_id` correspondant à la Variante sélectionnée.
2. WHEN le Panier contient un Plat avec une seule Variante ajouté sans sélection explicite, THE Page_Commande SHALL inclure automatiquement le `variante_id` de cette unique Variante dans la ligne soumise.
3. THE Page_Commande SHALL calculer le montant total du Panier à partir des prix des Variantes sélectionnées pour chaque article.

### Requirement 10: Propriétés d'intégrité testables

**User Story:** En tant que développeur, je veux vérifier les propriétés d'intégrité des variantes par des tests automatisés, afin de garantir la robustesse du système face à des données variées.

#### Acceptance Criteria

1. FOR ALL séquences de création, modification et suppression de Variantes sur un même Plat avec au moins une Variante conservée, THE Systeme SHALL maintenir l'invariant : le nombre de Variantes pour ce Plat est supérieur ou égal à 1.
2. FOR ALL Plats existants après exécution de la Migration, THE Systeme SHALL vérifier que le prix de la Variante à position 1 est égal au champ `prix` du Plat correspondant dans la table `plats`.
3. FOR ALL requêtes POST `/api/v1/commandes` avec un `variante_id` valide appartenant au bon Plat, THE Systeme SHALL enregistrer dans `lignes_commande.prix_unitaire` une valeur égale au prix de la Variante identifiée par ce `variante_id`.
4. WHEN une séquence création, lecture, modification, lecture est appliquée à une Variante, THE API_Admin SHALL retourner à chaque lecture les valeurs exactes qui ont été écrites lors de la dernière écriture.
