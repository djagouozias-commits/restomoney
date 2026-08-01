# Requirements Document

## Introduction

Ce document décrit les exigences fonctionnelles et non fonctionnelles de l'application de commande de repas destinée aux entreprises partenaires d'un restaurant/traiteur. L'application permet aux employés des structures clientes de commander parmi des plats du jour et des menus complets (combos/promotions), livrés sur des créneaux horaires fixes. Un back-office complet est mis à disposition du Super Admin pour gérer l'ensemble du cycle : structures, plats, planification, commandes, logistique et pénalités de retard.

La promesse de marque — *« Vos plats sont livrés bien chauds. Une promesse que nous honorons depuis 5 ans. »* — est affichée sur la page d'accueil, l'écran de confirmation de commande et le reçu.

---

## Glossary

- **Super_Admin** : compte administrateur du restaurant, disposant d'un accès complet au back-office.
- **Structure** : entreprise cliente ayant adhéré au programme alimentaire ; identifiée par un identifiant unique et un mot de passe générés par le Super_Admin.
- **Employé** : utilisateur final rattaché à une Structure, qui se connecte avec les credentials de sa Structure pour passer des commandes.
- **Plat** : plat principal du jour, avec image, nom, description et prix.
- **Plat_Du_Jour** : l'un des 3 plats proposés chaque jour selon le Planning_Hebdomadaire.
- **Menu_Complet** : formule à prix fixe composée de plusieurs éléments, dont certains offrent un choix parmi une liste d'options.
- **Composant** : élément d'un Menu_Complet (ex. riz gras, jus au choix).
- **Option** : valeur sélectionnable pour un Composant à choix (ex. baobab, bissap, citron, ananas).
- **Créneau** : fenêtre de livraison fixe — 09h00, 12h00, 16h00 ou 20h00.
- **Fenêtre_De_Tolérance** : intervalle de 10 minutes après l'heure du Créneau pendant lequel la livraison est considérée dans les délais.
- **Délai_Minimum_Commande** : règle imposant qu'une commande soit passée au moins 60 minutes avant l'heure du Créneau visé.
- **Commande** : ensemble d'articles (Plats et/ou Menus_Complets) passés pour un Créneau donné par un Employé d'une Structure.
- **Panier** : état temporaire regroupant les articles sélectionnés avant validation de la Commande.
- **Planning_Hebdomadaire** : configuration récurrente associant 3 Plats à chaque jour de la semaine.
- **Rotation_Automatique** : mécanisme déclenchant à 00h00 le remplacement des Plats_Du_Jour par ceux du nouveau jour selon le Planning_Hebdomadaire.
- **Pénalité** : remise de 50 % accordée à la Structure sur le prix des plats d'une Commande livrée hors Fenêtre_De_Tolérance, si la clause est activée.
- **Tournée** : circuit de livraison ordonné du restaurant vers les Structures pour un Créneau donné.
- **Livreur** : agent effectuant la Tournée ; ses déplacements sont tracés dans le back-office.
- **Système** : l'ensemble de l'application (frontend + backend).
- **Back_Office** : interface d'administration réservée au Super_Admin.

---

## Requirements

---

### Exigence 1 : Authentification des utilisateurs

**User Story :** En tant qu'Employé d'une Structure, je veux me connecter avec les credentials fournis par l'admin, afin d'accéder à l'interface de commande réservée à ma Structure.

#### Critères d'acceptation

1. THE Système SHALL afficher un écran de connexion unique demandant un identifiant et un mot de passe.
2. WHEN un Employé soumet des credentials valides correspondant à une Structure active, THE Système SHALL ouvrir une session authentifiée et rediriger vers l'interface de commande de la Structure.
3. IF les credentials soumis ne correspondent à aucune Structure active, THEN THE Système SHALL afficher un message d'erreur générique sans préciser si l'identifiant ou le mot de passe est incorrect.
4. WHILE une session est ouverte, THE Système SHALL restreindre la visibilité des commandes et de l'historique à la seule Structure associée aux credentials utilisés.
5. WHEN une session est inactive depuis 30 minutes, THE Système SHALL expirer la session et rediriger l'Employé vers l'écran de connexion.
6. THE Back_Office SHALL disposer d'un accès d'authentification séparé, accessible uniquement au Super_Admin, distinct de l'écran de connexion des Structures.

---

### Exigence 2 : Gestion des Structures (entreprises clientes)

**User Story :** En tant que Super_Admin, je veux créer et gérer les comptes des Structures partenaires, afin de contrôler l'accès à l'application et de disposer de leurs informations de livraison.

#### Critères d'acceptation

1. WHEN le Super_Admin crée une nouvelle Structure en fournissant un nom, un domaine d'activité, un numéro de téléphone et des coordonnées GPS (latitude, longitude), THE Système SHALL enregistrer la Structure avec un statut actif.
2. WHEN une nouvelle Structure est enregistrée, THE Système SHALL générer automatiquement un identifiant unique et un mot de passe pour cette Structure.
3. THE Système SHALL afficher au Super_Admin l'identifiant et le mot de passe générés immédiatement après la création, afin qu'ils puissent être communiqués à la Structure.
4. WHEN le Super_Admin modifie les informations d'une Structure existante, THE Système SHALL enregistrer les modifications sans altérer l'identifiant unique de la Structure.
5. WHEN le Super_Admin désactive une Structure, THE Système SHALL empêcher toute nouvelle connexion avec les credentials de cette Structure.
6. THE Back_Office SHALL permettre au Super_Admin de consulter la liste des Structures avec leur statut (actif / inactif), leur domaine d'activité et leur localisation GPS.

---

### Exigence 3 : Gestion des Plats du Jour

**User Story :** En tant que Super_Admin, je veux configurer les plats disponibles chaque jour, afin que les Employés voient une offre à jour et pertinente.

#### Critères d'acceptation

1. THE Super_Admin SHALL pouvoir créer un Plat en fournissant un nom, une description, une image et un prix.
2. WHEN le Super_Admin active un Plat pour un jour donné, THE Système SHALL rendre ce Plat visible pour les Structures éligibles sur l'interface de commande de ce jour.
3. THE Back_Office SHALL afficher les Plats sous forme de carrousel permettant de visualiser l'image, le nom, la description et le prix de chaque Plat.
4. THE Super_Admin SHALL pouvoir désactiver un Plat afin qu'il ne soit plus proposé à la commande sans le supprimer définitivement.
5. WHEN il est 00h00, THE Système SHALL retirer automatiquement les Plats_Du_Jour de la veille et activer les Plats planifiés pour le nouveau jour selon le Planning_Hebdomadaire (Rotation_Automatique).
6. IF aucun Plat n'est planifié pour un jour donné et qu'aucune surcharge ponctuelle n'est définie, THEN THE Système SHALL afficher un message indiquant qu'aucun plat n'est disponible pour ce jour.

---

### Exigence 4 : Planification Hebdomadaire

**User Story :** En tant que Super_Admin, je veux pré-configurer les 3 plats du jour pour chaque jour de la semaine, afin que la rotation s'effectue automatiquement sans intervention quotidienne.

#### Critères d'acceptation

1. THE Super_Admin SHALL pouvoir associer exactement 3 Plats à chacun des 7 jours de la semaine (lundi à dimanche) dans le Planning_Hebdomadaire.
2. WHEN le Planning_Hebdomadaire est enregistré, THE Système SHALL appliquer la Rotation_Automatique chaque nuit à 00h00 en activant les 3 Plats correspondant au nouveau jour.
3. THE Super_Admin SHALL pouvoir surcharger ponctuellement les Plats d'un jour précis sans modifier le Planning_Hebdomadaire récurrent.
4. WHEN une surcharge ponctuelle est définie pour un jour, THE Système SHALL utiliser les Plats de la surcharge à la place de ceux du Planning_Hebdomadaire pour ce jour uniquement.
5. THE Back_Office SHALL afficher le Planning_Hebdomadaire sous forme de vue semaine (type carrousel) permettant de visualiser et modifier les 3 Plats de chaque jour.

---

### Exigence 5 : Gestion des Menus Complets (Combos / Promotions)

**User Story :** En tant que Super_Admin, je veux créer des formules à prix fixe composées de plusieurs éléments, afin d'offrir aux Employés des offres groupées attractives.

#### Critères d'acceptation

1. THE Super_Admin SHALL pouvoir créer un Menu_Complet en définissant un nom, une description, une image, un prix fixe et une liste de Composants.
2. WHEN un Composant d'un Menu_Complet offre un choix, THE Super_Admin SHALL pouvoir définir la liste des Options disponibles pour ce Composant.
3. THE Système SHALL afficher le prix fixe global du Menu_Complet sans recalcul en fonction des Options sélectionnées.
4. WHEN un Employé ajoute un Menu_Complet au Panier et que ce Menu_Complet contient des Composants à choix, THE Système SHALL exiger la sélection d'une Option pour chaque Composant à choix avant de valider l'ajout.
5. THE Super_Admin SHALL pouvoir modifier ou supprimer un Menu_Complet existant.
6. WHEN le Super_Admin désactive un Menu_Complet, THE Système SHALL retirer ce Menu_Complet de l'interface de commande sans le supprimer définitivement.

---

### Exigence 6 : Gestion des Créneaux de Livraison et Règle du Délai Minimum

**User Story :** En tant qu'Employé, je veux sélectionner un créneau de livraison, afin de recevoir ma commande à l'heure souhaitée, en sachant que le système m'empêche de commander trop tard.

#### Critères d'acceptation

1. THE Système SHALL proposer exactement 4 Créneaux fixes par jour : 09h00, 12h00, 16h00 et 20h00.
2. WHEN un Employé sélectionne un Créneau pour une Commande, THE Système SHALL vérifier que l'heure de création de la Commande est antérieure d'au moins 60 minutes à l'heure du Créneau.
3. IF l'heure courante est à moins de 60 minutes d'un Créneau, THEN THE Système SHALL rendre ce Créneau non sélectionnable et proposer automatiquement le Créneau suivant disponible dans la journée.
4. IF aucun Créneau disponible n'existe pour la journée courante, THEN THE Système SHALL informer l'Employé qu'aucun Créneau n'est disponible ce jour et l'inviter à revenir le lendemain.
5. WHEN un Employé débute une session de commande le matin, THE Système SHALL permettre de composer et valider les Commandes pour les 4 Créneaux de la journée en une seule session.
6. THE Système SHALL associer chaque Commande validée à la Structure de l'Employé connecté, au Créneau sélectionné et à la date du jour.

---

### Exigence 7 : Interface de Commande Employé (Panier et Validation)

**User Story :** En tant qu'Employé, je veux sélectionner des plats et des menus complets dans un panier, afin de valider ma commande facilement.

#### Critères d'acceptation

1. THE Système SHALL afficher sur la page d'accueil de l'interface de commande les 3 Plats_Du_Jour du jour courant avec leur image, nom, description et prix.
2. THE Système SHALL afficher une section dédiée aux Menus_Complets actifs avec leur image, nom, description et prix fixe.
3. WHEN un Employé ajoute un article (Plat ou Menu_Complet) au Panier, THE Système SHALL mettre à jour le récapitulatif du Panier en temps réel avec les articles, quantités et montant total.
4. THE Système SHALL permettre à l'Employé de modifier les quantités ou de retirer des articles du Panier avant validation.
5. WHEN l'Employé valide une Commande, THE Système SHALL enregistrer la Commande avec le statut « en attente », afficher un écran de confirmation incluant le récapitulatif de la commande et la promesse de marque, et vider le Panier.
6. THE Système SHALL afficher la promesse de marque « Vos plats sont livrés bien chauds. Une promesse que nous honorons depuis 5 ans. » sur la page d'accueil, l'écran de confirmation de commande et le reçu.
7. THE Système SHALL permettre à l'Employé de consulter l'historique des Commandes de sa Structure.

---

### Exigence 8 : Suivi des Commandes et Agrégation par Structure

**User Story :** En tant que Super_Admin, je veux consulter un récapitulatif des commandes agrégées par structure et par créneau, afin d'organiser la préparation et la livraison.

#### Critères d'acceptation

1. THE Back_Office SHALL afficher pour chaque Structure et chaque Créneau la liste des Commandes du jour avec les quantités agrégées par Plat et par Menu_Complet.
2. THE Back_Office SHALL permettre de filtrer les Commandes par Structure, par Créneau (09h / 12h / 16h / 20h) et par date.
3. THE Système SHALL calculer et afficher le volume total de chaque Plat et Menu_Complet commandé par Créneau sur l'ensemble des Structures, afin de faciliter la préparation en cuisine.
4. WHEN le statut d'une Commande est modifié par le Super_Admin (ex. « en préparation », « en livraison », « livré »), THE Système SHALL enregistrer l'heure de la mise à jour du statut.
5. THE Système SHALL conserver l'historique de toutes les Commandes avec leur date, Créneau, Structure, articles et statut final.

---

### Exigence 9 : Détection des Retards et Application des Pénalités

**User Story :** En tant que Super_Admin, je veux être alerté des livraisons en retard et pouvoir appliquer la pénalité contractuelle, afin d'honorer les engagements SLA envers les Structures.

#### Critères d'acceptation

1. WHEN l'heure courante dépasse la Fenêtre_De_Tolérance d'un Créneau (c'est-à-dire dépasse l'heure du Créneau + 10 minutes) et que la Commande n'est pas encore marquée « livré », THE Système SHALL marquer automatiquement la Commande comme « en retard ».
2. THE Back_Office SHALL afficher dans un tableau de bord dédié toutes les Commandes marquées « en retard » pour le jour courant et les jours précédents.
3. WHEN le Super_Admin active la clause de pénalité sur une Commande marquée « en retard », THE Système SHALL appliquer une remise de 50 % sur le prix des Plats et Menus_Complets de cette Commande et enregistrer la Pénalité.
4. WHEN une Pénalité est appliquée à une Commande, THE Système SHALL afficher le montant réduit dans le récapitulatif de la Commande et marquer la Commande avec le flag « pénalité appliquée ».
5. THE Back_Office SHALL permettre au Super_Admin de distinguer visuellement les Commandes en retard sans pénalité, les Commandes en retard avec pénalité appliquée et les Commandes livrées dans les délais.

---

### Exigence 10 : Suivi Logistique et Cartographie des Tournées

**User Story :** En tant que Super_Admin, je veux visualiser le circuit de livraison sur une carte, afin de planifier et de suivre les Tournées du Livreur.

#### Critères d'acceptation

1. THE Back_Office SHALL afficher sur une carte interactive le circuit de livraison ordonné pour chaque Tournée : restaurant → Structure A → Structure B → Structure C → retour restaurant.
2. THE Système SHALL calculer l'ordre des Structures sur la carte en fonction de leurs coordonnées GPS pour optimiser le circuit.
3. THE Super_Admin SHALL pouvoir réordonner manuellement les points d'arrêt de la Tournée sur la carte.
4. WHEN le statut d'une Tournée est mis à jour (ex. « en cours », « livraison effectuée au point N »), THE Back_Office SHALL mettre à jour l'affichage de la carte en conséquence.
5. THE Système SHALL associer chaque Tournée à un Créneau et une date, et conserver l'historique des Tournées.

---

### Exigence 11 : Rotation Automatique des Plats à Minuit

**User Story :** En tant que Super_Admin, je veux que les plats du jour se renouvellent automatiquement chaque nuit à minuit, afin de ne pas avoir à intervenir manuellement chaque jour.

#### Critères d'acceptation

1. WHEN il est 00h00, THE Système SHALL désactiver tous les Plats_Du_Jour actifs de la veille et activer les 3 Plats configurés pour le nouveau jour dans le Planning_Hebdomadaire ou la surcharge ponctuelle correspondante.
2. THE Système SHALL exécuter la Rotation_Automatique de manière idempotente : si elle est déclenchée plusieurs fois à 00h00 pour le même jour, THE Système SHALL produire le même résultat sans dupliquer les activations.
3. IF la Rotation_Automatique échoue (erreur technique), THEN THE Système SHALL journaliser l'erreur et notifier le Super_Admin par un indicateur visible dans le Back_Office.
4. THE Système SHALL conserver un journal horodaté de chaque Rotation_Automatique exécutée avec succès ou en échec.

---

### Exigence 12 : Reçu et Confirmation de Commande

**User Story :** En tant qu'Employé, je veux recevoir une confirmation détaillée après avoir passé une commande, afin d'avoir une trace de ce que j'ai commandé.

#### Critères d'acceptation

1. WHEN une Commande est validée, THE Système SHALL générer un reçu contenant : l'identifiant de la Commande, la date, le Créneau, le nom de la Structure, la liste des articles avec quantités et prix unitaires, le montant total et la promesse de marque.
2. THE Système SHALL afficher le reçu immédiatement après la validation de la Commande.
3. THE Système SHALL rendre le reçu accessible depuis l'historique des Commandes de la Structure.
4. IF une Pénalité a été appliquée à une Commande, THEN THE Système SHALL faire apparaître sur le reçu le montant original, la remise de 50 % et le montant final après remise.

---

### Exigence 13 : Expérience Utilisateur et Promesse de Marque

**User Story :** En tant qu'Employé, je veux utiliser une interface agréable et cohérente avec la promesse du restaurant, afin d'avoir confiance en la qualité du service.

#### Critères d'acceptation

1. THE Système SHALL présenter une interface responsive adaptée aux écrans mobiles (approche mobile-first) et aux écrans de bureau.
2. THE Système SHALL afficher la promesse de marque « Vos plats sont livrés bien chauds. Une promesse que nous honorons depuis 5 ans. » de manière visible sur la page d'accueil, l'écran de confirmation de commande et le reçu.
3. THE Système SHALL afficher les images des Plats et des Menus_Complets avec une qualité suffisante pour être reconnaissables sur écran mobile.
4. WHEN un Employé navigue sur l'interface de commande, THE Système SHALL afficher les Créneaux disponibles et non disponibles de manière visuellement distincte (ex. grisés pour les Créneaux dépassant le Délai_Minimum_Commande).

---

### Exigence 14 : Sécurité et Contrôle d'Accès

**User Story :** En tant que Super_Admin, je veux que les accès à l'application soient strictement contrôlés, afin de protéger les données des Structures et l'intégrité des commandes.

#### Critères d'acceptation

1. THE Système SHALL empêcher tout accès aux données de commande, à l'historique ou aux informations d'une Structure sans session authentifiée valide.
2. THE Système SHALL empêcher un Employé d'une Structure d'accéder aux données d'une autre Structure.
3. THE Système SHALL empêcher tout accès au Back_Office sans credentials Super_Admin valides.
4. WHEN le Super_Admin régénère le mot de passe d'une Structure, THE Système SHALL invalider l'ancien mot de passe immédiatement.
5. THE Système SHALL stocker les mots de passe des Structures sous forme hachée et ne jamais les exposer en clair après leur génération initiale.
