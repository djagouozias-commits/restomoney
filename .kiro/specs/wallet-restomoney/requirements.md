# Requirements Document

## Introduction

Le Wallet RestoMoney est un portefeuille électronique associé à chaque structure (entreprise cliente). Il permet à une structure de financer les repas de ses employés en FCFA via un solde pré-chargé. L'administrateur peut recharger ce solde directement, et la structure peut débiter son wallet lors du paiement des commandes. Une fonctionnalité clé est la **demande de complément de fonds** : quand le solde est insuffisant, la structure soumet une demande, un agent se déplace physiquement pour collecter l'argent, puis l'administrateur confirme la réception et crédite le solde.

## Glossary

- **Wallet** : Portefeuille électronique appartenant à une structure, exprimé en FCFA.
- **Structure** : Entreprise cliente ayant un compte dans le système.
- **Admin** : Super-administrateur de la plateforme RestoMoney.
- **WalletService** : Service backend responsable de toutes les opérations sur le wallet.
- **Transaction** : Enregistrement d'une opération financière (recharge, débit, remboursement) dans la table `wallet_transactions`.
- **Demande** : Demande de complément de fonds soumise par une structure, enregistrée dans la table `wallet_demandes`.
- **Solde** : Montant disponible en FCFA dans le wallet d'une structure.
- **Agent** : Personne physique mandatée par l'admin pour collecter les fonds auprès de la structure.
- **Transaction_Atomique** : Opération de base de données exécutée dans une transaction SQL garantissant qu'aucun état intermédiaire incohérent n'est persisté.

---

## Requirements

### Requirement 1: Wallet de base par structure

**User Story:** En tant qu'administrateur, je veux que chaque structure dispose automatiquement d'un wallet, afin que les paiements puissent être gérés de façon centralisée.

#### Acceptance Criteria

1. THE WalletService SHALL créer automatiquement un wallet avec un solde initial de 0 FCFA lors de la création d'une nouvelle structure.
2. THE WalletService SHALL maintenir un solde en FCFA sous forme de valeur entière positive ou nulle.
3. WHEN une opération financière est effectuée sur un wallet, THE WalletService SHALL enregistrer une entrée dans la table `wallet_transactions` contenant le type d'opération, le montant, le solde avant opération, le solde après opération, et l'horodatage.
4. THE WalletService SHALL garantir qu'un seul wallet existe par structure à tout moment.

---

### Requirement 2: Recharge du wallet par l'administrateur

**User Story:** En tant qu'administrateur, je veux pouvoir recharger le wallet d'une structure avec un montant arbitraire, afin de créditer manuellement son solde.

#### Acceptance Criteria

1. WHEN l'admin soumet une recharge avec un montant valide pour une structure existante, THE WalletService SHALL créditer le solde du wallet dans une Transaction_Atomique et enregistrer la transaction de type `recharge`.
2. IF le montant de recharge est inférieur ou égal à zéro, THEN THE WalletService SHALL rejeter l'opération avec un code d'erreur `WALLET_INVALID_AMOUNT`.
3. WHEN une recharge est effectuée, THE WalletService SHALL enregistrer l'identifiant de l'Admin ayant effectué l'opération dans la Transaction.
4. THE WalletService SHALL exposer un endpoint accessible uniquement aux admins pour effectuer une recharge sur le wallet d'une Structure identifiée par son `structure_id`.

---

### Requirement 3: Débit du wallet lors du paiement

**User Story:** En tant que structure, je veux pouvoir payer une commande en débitant mon wallet, afin de régler les repas de mes employés sans paiement manuel.

#### Acceptance Criteria

1. WHEN une Structure déclenche un paiement via wallet pour un montant valide, THE WalletService SHALL vérifier que le Solde disponible est supérieur ou égal au montant demandé avant tout débit.
2. IF le Solde du wallet est insuffisant pour couvrir le montant demandé, THEN THE WalletService SHALL rejeter l'opération avec un code d'erreur `WALLET_INSUFFICIENT_FUNDS` sans modifier le Solde.
3. WHEN le Solde est suffisant, THE WalletService SHALL déduire le montant du Solde dans une Transaction_Atomique et enregistrer la Transaction de type `debit`.
4. WHEN une Structure initie un débit, THE WalletService SHALL exiger la confirmation du mot de passe de la Structure avant d'exécuter l'opération.
5. IF la confirmation du mot de passe est incorrecte, THEN THE WalletService SHALL rejeter l'opération avec un code d'erreur `AUTH_INVALID_CREDENTIALS` sans modifier le Solde.
6. THE WalletService SHALL garantir qu'un même débit ne peut pas être exécuté deux fois via l'utilisation de transactions SQL avec verrou de ligne.

---

### Requirement 4: Demande de complément de fonds

**User Story:** En tant que structure, je veux pouvoir soumettre une demande de complément de fonds quand mon solde est insuffisant, afin qu'un Agent vienne collecter l'argent physiquement et créditer mon compte.

#### Acceptance Criteria

1. WHEN une Structure soumet une Demande de complément de fonds, THE WalletService SHALL enregistrer la Demande avec les champs `montant_demande`, `adresse_collecte`, `contact`, `notes` (optionnel), et le statut initial `en_attente`.
2. IF le montant demandé est inférieur ou égal à zéro, THEN THE WalletService SHALL rejeter la soumission avec un code d'erreur `WALLET_INVALID_AMOUNT`.
3. IF le champ `adresse_collecte` ou `contact` est absent ou vide, THEN THE WalletService SHALL rejeter la soumission avec un code d'erreur `WALLET_MISSING_FIELDS`.
4. THE WalletService SHALL exposer les transitions de statut suivantes selon ce schéma strict : `en_attente` vers `acceptee` ou `refusee`, `acceptee` vers `collecte_en_cours`, `collecte_en_cours` vers `completee`.
5. WHEN l'Admin accepte une Demande en statut `en_attente`, THE WalletService SHALL mettre à jour le statut de la Demande à `acceptee`.
6. WHEN l'Admin démarre la collecte physique, THE WalletService SHALL mettre à jour le statut de la Demande à `collecte_en_cours`.
7. WHEN l'Admin confirme la réception des fonds physiques, THE WalletService SHALL mettre à jour le statut de la Demande à `completee` et créditer le Solde du wallet de la Structure du montant demandé dans une Transaction_Atomique.
8. WHEN l'Admin refuse une Demande, THE WalletService SHALL mettre à jour le statut de la Demande à `refusee` avec un motif de refus.
9. IF une Demande est dans un statut autre que `en_attente`, THEN THE WalletService SHALL rejeter toute tentative de retour vers `en_attente` avec un code d'erreur `WALLET_INVALID_TRANSITION`.
10. WHEN le statut d'une Demande est mis à jour, THE WalletService SHALL enregistrer l'horodatage de la mise à jour dans le champ `updated_at`.

---

### Requirement 5: Visibilité du solde et statut des demandes

**User Story:** En tant que structure, je veux être informée quand mon solde wallet est crédité, afin de savoir que la collecte a été validée et que je peux passer des commandes.

#### Acceptance Criteria

1. WHEN le Solde d'un wallet est crédité suite à la confirmation d'une Demande, THE WalletService SHALL mettre à jour le champ `updated_at` du wallet.
2. WHEN une Structure accède à son tableau de bord wallet, THE WalletService SHALL retourner le Solde courant et la date de dernière mise à jour.
3. WHEN une Structure consulte ses Demandes, THE WalletService SHALL retourner le statut courant de chaque Demande ainsi que l'horodatage de la dernière mise à jour de statut.

---

### Requirement 6: Historique des transactions

**User Story:** En tant qu'administrateur, je veux consulter l'historique de toutes les transactions et recharger les wallets depuis une interface dédiée, afin d'avoir une visibilité complète sur les finances des structures.

#### Acceptance Criteria

1. THE WalletService SHALL exposer un endpoint admin retournant la liste paginée de toutes les transactions classées par date décroissante, avec filtrage possible par `structure_id`.
2. WHEN une Structure consulte son historique, THE WalletService SHALL retourner uniquement les transactions et Demandes appartenant à cette Structure.
3. THE WalletService SHALL retourner pour chaque Transaction le type (`recharge`, `debit`, `credit_demande`), le montant, le solde avant, le solde après, et l'horodatage.
4. THE WalletService SHALL retourner pour chaque Demande le montant demandé, l'adresse de collecte, le contact, les notes, le statut, et l'horodatage de la dernière mise à jour.
5. WHILE une Structure est authentifiée, THE WalletService SHALL retourner le Solde courant de son wallet dans chaque réponse de consultation de compte.

---

### Requirement 7: Sécurité et intégrité des données

**User Story:** En tant qu'administrateur, je veux que toutes les opérations financières soient sécurisées et cohérentes, afin d'éviter toute incohérence ou fraude dans les soldes.

#### Acceptance Criteria

1. THE WalletService SHALL exécuter toute opération modifiant le Solde (recharge, débit, crédit Demande) dans une transaction SQL BEGIN/COMMIT pour garantir l'atomicité.
2. IF une transaction SQL échoue ou est interrompue, THEN THE WalletService SHALL exécuter un ROLLBACK et retourner un code d'erreur `WALLET_TRANSACTION_FAILED` sans modifier le Solde.
3. THE WalletService SHALL utiliser un verrou de ligne via `SELECT FOR UPDATE` sur le wallet lors de toute opération de modification du Solde pour prévenir les conditions de course.
4. THE WalletService SHALL rejeter toute requête de modification de wallet provenant d'un utilisateur n'ayant pas les droits nécessaires avec un code d'erreur `AUTH_FORBIDDEN`.
5. WHEN une Structure effectue un débit, THE WalletService SHALL valider le mot de passe avant d'acquérir le verrou sur le wallet.
