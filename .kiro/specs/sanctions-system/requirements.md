# Requirements Document

## Introduction

Le système de sanctions gère automatiquement les pénalités appliquées aux commandes livrées en retard dans l'application resto-money. Quatre niveaux de sanction sont définis selon la durée du retard. Les seuils et pourcentages sont configurables par l'admin depuis une interface dédiée, sans modification du code. Le système s'intègre au cron de détection des retards existant (`retardCron.ts`) pour appliquer les sanctions automatiquement.

## Glossary

- **Sanction_Service** : Service backend responsable du calcul et de l'application des sanctions.
- **Admin_Interface** : Interface frontend Next.js permettant à l'administrateur de configurer les paramètres de sanctions.
- **Parametres_Sanctions** : Table PostgreSQL stockant les seuils de minutes et les actions de sanction pour chaque niveau.
- **Niveau_Sanction** : Niveau de pénalité (1 à 4) correspondant à une plage de minutes de retard.
- **Bon_Reduction** : Bon de réduction émis pour une commande future suite à un retard important.
- **Retard_Cron** : Job cron existant (`retardCron.ts`) qui détecte les commandes en retard toutes les minutes.
- **Commande** : Enregistrement dans la table `commandes` representant une commande d'une structure.
- **Minutes_Retard** : Nombre entier de minutes écoulées au-delà du créneau prévu d'une commande.
- **Montant_Final** : Montant effectivement facturé à la structure après application de la sanction.

---

## Requirements

### Requirement 1: Paramétrage des niveaux de sanction

**User Story:** En tant qu'administrateur, je veux configurer les seuils et actions de chaque niveau de sanction, afin de pouvoir ajuster les règles métier sans modifier le code.

#### Acceptance Criteria

1. THE Parametres_Sanctions SHALL stocker pour chaque niveau : un identifiant de niveau (1–4), un seuil minimum de minutes de retard (`min_minutes`), un seuil maximum de minutes de retard (`max_minutes`, NULL pour illimité), un pourcentage de réduction appliqué au montant (`reduction_pct` entre 0 et 100), et un indicateur booléen d'émission de bon de réduction (`emettre_bon`).
2. THE Parametres_Sanctions SHALL être initialisée avec les valeurs par défaut suivantes : Niveau 1 (5–9 min, −50 %, pas de bon), Niveau 2 (10–19 min, −100 %, pas de bon), Niveau 3 (20+ min, −100 %, bon de réduction émis).
3. WHEN l'administrateur modifie un paramètre de sanction, THE Admin_Interface SHALL envoyer les nouvelles valeurs au Sanction_Service via une requête HTTP PATCH authentifiée.
4. IF une valeur de `reduction_pct` inférieure à 0 ou supérieure à 100 est soumise, THEN THE Sanction_Service SHALL retourner une erreur de validation avec le code HTTP 422.
5. IF une valeur de `min_minutes` négative est soumise, THEN THE Sanction_Service SHALL retourner une erreur de validation avec le code HTTP 422.

---

### Requirement 2: Calcul du niveau de sanction

**User Story:** En tant que système, je veux déterminer le niveau de sanction applicable à une commande en retard, afin d'appliquer la pénalité correcte selon les paramètres configurés.

#### Acceptance Criteria

1. WHEN le Sanction_Service reçoit une commande avec un nombre de Minutes_Retard, THE Sanction_Service SHALL interroger la table Parametres_Sanctions pour trouver le niveau dont `min_minutes <= Minutes_Retard < max_minutes` (ou `min_minutes <= Minutes_Retard` si `max_minutes` est NULL).
2. WHEN les Minutes_Retard sont strictement inférieures à 5, THE Sanction_Service SHALL retourner un niveau de sanction nul (aucune pénalité).
3. WHEN un niveau de sanction est trouvé avec `reduction_pct = 50`, THE Sanction_Service SHALL calculer le Montant_Final comme `ROUND(montant_total * 0.50, 2)`.
4. WHEN un niveau de sanction est trouvé avec `reduction_pct = 100`, THE Sanction_Service SHALL calculer le Montant_Final comme `0.00`.
5. FOR ALL valeurs entières de Minutes_Retard comprises entre 0 et 1000, THE Sanction_Service SHALL trouver au plus un niveau de sanction applicable (propriété d'absence de chevauchement).
6. IF aucun niveau de sanction ne correspond aux Minutes_Retard et que celles-ci sont supérieures ou égales à 5, THEN THE Sanction_Service SHALL journaliser un avertissement et ne pas modifier la commande.

---

### Requirement 3: Application automatique des sanctions

**User Story:** En tant que système, je veux appliquer automatiquement les sanctions aux commandes détectées en retard, afin que les pénalités soient enregistrées sans intervention humaine.

#### Acceptance Criteria

1. WHEN le Retard_Cron détecte une ou plusieurs commandes en retard, THE Sanction_Service SHALL calculer les Minutes_Retard pour chaque commande comme la différence en minutes entre l'heure courante et le créneau prévu.
2. WHEN une sanction de niveau 1 (5–9 min) est applicable, THE Sanction_Service SHALL mettre à jour la commande avec `penalite = true` et `montant_final = ROUND(montant_total * 0.50, 2)`.
3. WHEN une sanction de niveau 2 (10–19 min) est applicable, THE Sanction_Service SHALL mettre à jour la commande avec `penalite = true` et `montant_final = 0.00`.
4. WHEN une sanction de niveau 3 (20+ min) est applicable, THE Sanction_Service SHALL mettre à jour la commande avec `penalite = true`, `montant_final = 0.00`, et émettre un bon de réduction pour la prochaine commande de la structure concernée.
5. WHEN une commande possède déjà `penalite = true`, THE Sanction_Service SHALL ne pas recalculer ni écraser la sanction existante.
6. IF une erreur survient lors de l'application d'une sanction sur une commande individuelle, THEN THE Sanction_Service SHALL journaliser l'erreur avec l'identifiant de la commande et continuer le traitement des autres commandes.

---

### Requirement 4: Gestion des bons de réduction

**User Story:** En tant que structure, je veux recevoir un bon de réduction sur ma prochaine commande lorsque mon retard dépasse 20 minutes, afin d'être compensée pour l'attente.

#### Acceptance Criteria

1. THE Bons_Reduction SHALL stocker pour chaque bon : un identifiant unique, l'identifiant de la structure bénéficiaire, le pourcentage de réduction (`valeur_pct`), la date d'émission, la date d'expiration, et un indicateur d'utilisation (`utilise`).
2. WHEN un bon de réduction est émis suite à une sanction de niveau 3, THE Sanction_Service SHALL créer un enregistrement dans la table Bons_Reduction avec `utilise = false` et une date d'expiration de 30 jours après la date d'émission.
3. WHEN une structure passe une nouvelle commande et possède un bon de réduction valide (`utilise = false` et date d'expiration non dépassée), THE Commande SHALL appliquer automatiquement le bon et le marquer comme `utilise = true`.
4. WHEN plusieurs retards de niveau 3 ou plus sont accumulés pour une même structure, THE Sanction_Service SHALL émettre un bon de réduction supplémentaire par retard (accumulation cumulative).
5. IF une structure tente d'utiliser un bon dont la date d'expiration est dépassée, THEN THE Sanction_Service SHALL rejeter le bon et retourner une erreur avec le code HTTP 422.
6. THE Bon_Reduction SHALL avoir une valeur de `valeur_pct` entre 1 et 100 inclus.

---

### Requirement 5: Interface d'administration des paramètres

**User Story:** En tant qu'administrateur, je veux une page dédiée pour consulter et modifier les paramètres de chaque niveau de sanction, afin d'ajuster les règles sans intervention technique.

#### Acceptance Criteria

1. THE Admin_Interface SHALL afficher les quatre niveaux de sanction avec leurs paramètres actuels (`min_minutes`, `max_minutes`, `reduction_pct`, `emettre_bon`).
2. WHEN l'administrateur soumet une modification de paramètres, THE Admin_Interface SHALL afficher un indicateur de chargement pendant la requête et un message de confirmation après succès.
3. IF la requête de modification échoue, THEN THE Admin_Interface SHALL afficher un message d'erreur explicite sans perdre les valeurs saisies par l'administrateur.
4. THE Admin_Interface SHALL protéger la page de configuration par authentification admin et retourner HTTP 401 pour tout accès non authentifié.
5. THE Admin_Interface SHALL afficher en lecture seule la liste des bons de réduction émis avec leur statut (`utilise` ou non) et leur date d'expiration.

---

### Requirement 6: Observabilité et journalisation

**User Story:** En tant qu'administrateur, je veux que chaque application de sanction soit journalisée, afin de pouvoir auditer l'historique des pénalités appliquées.

#### Acceptance Criteria

1. WHEN une sanction est appliquée à une commande, THE Sanction_Service SHALL journaliser en console : l'identifiant de la commande, l'identifiant de la structure, les Minutes_Retard, le niveau de sanction appliqué, et le Montant_Final calculé.
2. WHEN un bon de réduction est émis, THE Sanction_Service SHALL journaliser l'identifiant du bon, l'identifiant de la structure, et la date d'expiration.
3. THE Admin_Interface SHALL exposer via l'API un historique des sanctions appliquées, filtrable par date et par structure.
