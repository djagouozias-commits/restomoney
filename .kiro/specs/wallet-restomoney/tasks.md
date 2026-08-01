# Plan d'implémentation — Wallet RestoMoney

## Vue d'ensemble

Implémentation du système de wallet en FCFA pour les structures clientes : migration DB, service métier, routes backend, et pages frontend (admin + structure).

---

## Tâches

- [ ] 1. Migration de base de données et types partagés
  - Créer le fichier `apps/backend/src/db/migrations/020_create_wallets.sql` avec les tables `wallets`, `wallet_transactions`, `wallet_demandes` (contraintes CHECK, index, clés étrangères)
  - Ajouter les interfaces TypeScript `Wallet`, `Transaction`, `Demande`, `DemandeInput`, `TransactionPage`, `DemandeStatut`, `TransactionType` dans `apps/backend/src/types/wallet.ts`
  - Vérifier que la migration `020` est exécutée au démarrage via `runMigrations()` dans `migrate.ts`
  - _Exigences : 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Implémenter le WalletService — opérations de base
  - Créer `apps/backend/src/services/walletService.ts`
  - Implémenter `getWalletByStructure(structureId)` : SELECT avec WALLET_NOT_FOUND si absent
  - Implémenter `createWalletForStructure(structureId, client)` : INSERT dans wallets avec solde 0, appelé dans le service de création de structure (StructureService) au sein de la même transaction SQL
  - Implémenter `getTransactions(structureId, page, limit)` : SELECT paginé filtré par wallet de la structure, ordre `created_at DESC`
  - _Exigences : 1.1, 1.2, 1.3, 1.4, 6.2, 6.3_

  - [ ]* 2.1 Test de propriété — unicité du wallet par structure
    - **Propriété 6 : Unicité du wallet par structure**
    - Générer N structures avec fast-check, appeler `createWalletForStructure`, vérifier 1 wallet par structure avec solde = 0
    - **Valide : Exigences 1.1, 1.4**
    - `// Feature: wallet-restomoney, Property 6: Pour toute structure créée, exactement un wallet lui est associé`

  - [ ]* 2.2 Test de propriété — isolation de l'historique
    - **Propriété 9 : Isolation de l'historique par structure**
    - Générer deux structures avec transactions distinctes, vérifier que `getTransactions` ne retourne jamais des transactions d'une autre structure
    - **Valide : Exigences 6.2**
    - `// Feature: wallet-restomoney, Property 9: Pour toute structure, son historique ne contient que ses propres transactions`

- [ ] 3. Implémenter le WalletService — recharge admin
  - Implémenter `recharge(structureId, montant, adminId)` dans `walletService.ts` :
    - Valider `montant > 0` → `WALLET_INVALID_AMOUNT`
    - Ouvrir une transaction SQL (`BEGIN`)
    - `SELECT ... FOR UPDATE` sur le wallet
    - `UPDATE wallets SET solde = solde + montant, updated_at = NOW()`
    - `INSERT INTO wallet_transactions` (type=`recharge`, montant, solde_avant, solde_apres, admin_id)
    - `COMMIT` ou `ROLLBACK` en cas d'erreur → `WALLET_TRANSACTION_FAILED`
  - _Exigences : 2.1, 2.2, 2.3, 7.1, 7.2, 7.3_

  - [ ]* 3.1 Test de propriété — arithmétique de recharge
    - **Propriété 2 : Arithmétique de recharge**
    - Générer des paires (solde_initial, montant > 0) aléatoires, vérifier `solde_après = solde_avant + montant`
    - **Valide : Exigences 2.1**
    - `// Feature: wallet-restomoney, Property 2: Pour tout montant m > 0, solde_après = solde_avant + m`

  - [ ]* 3.2 Test de propriété — rejet des montants invalides
    - **Propriété 10 : Rejet des montants invalides**
    - Générer des montants `m ≤ 0`, vérifier rejet `WALLET_INVALID_AMOUNT` et solde inchangé
    - **Valide : Exigences 2.2, 4.2**
    - `// Feature: wallet-restomoney, Property 10: Pour tout montant m ≤ 0, opération rejetée et solde inchangé`

- [ ] 4. Implémenter le WalletService — débit structure
  - Implémenter `debiter(structureId, montant, password)` dans `walletService.ts` :
    - Valider `montant > 0` → `WALLET_INVALID_AMOUNT`
    - Vérifier le mot de passe bcrypt de la structure → `AUTH_INVALID_CREDENTIALS`
    - Ouvrir une transaction SQL (`BEGIN`)
    - `SELECT ... FOR UPDATE` sur le wallet
    - Vérifier `solde >= montant` → `WALLET_INSUFFICIENT_FUNDS` + ROLLBACK si non
    - `UPDATE wallets SET solde = solde - montant, updated_at = NOW()`
    - `INSERT INTO wallet_transactions` (type=`debit`, montant, solde_avant, solde_apres)
    - `COMMIT` ou `ROLLBACK` en cas d'erreur
  - _Exigences : 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1, 7.2, 7.3_

  - [ ]* 4.1 Test de propriété — arithmétique de débit
    - **Propriété 3 : Arithmétique de débit**
    - Générer des paires (solde, montant) avec `0 < montant ≤ solde`, vérifier `solde_après = solde - montant`
    - **Valide : Exigences 3.3**
    - `// Feature: wallet-restomoney, Property 3: Pour tout 0 < m ≤ solde, solde_après = solde - m`

  - [ ]* 4.2 Test de propriété — rejet des débits insuffisants
    - **Propriété 4 : Rejet des débits insuffisants**
    - Générer des paires (solde, montant) avec `montant > solde`, vérifier rejet et solde inchangé
    - **Valide : Exigences 3.1, 3.2**
    - `// Feature: wallet-restomoney, Property 4: Pour tout m > solde, opération rejetée et solde inchangé`

  - [ ]* 4.3 Test de propriété — invariant de solde non-négatif
    - **Propriété 1 : Invariant de solde non-négatif**
    - Générer des séquences aléatoires de recharges et débits valides, vérifier que le solde final est toujours ≥ 0
    - **Valide : Exigences 1.2, 3.2, 3.3**
    - `// Feature: wallet-restomoney, Property 1: Pour toute séquence d'opérations valides, solde ≥ 0`

  - [ ]* 4.4 Test de propriété — enregistrement systématique des transactions
    - **Propriété 5 : Enregistrement systématique des transactions**
    - Pour toute opération valide (recharge ou débit), vérifier qu'exactement une transaction est insérée avec les bons solde_avant et solde_apres
    - **Valide : Exigences 1.3**
    - `// Feature: wallet-restomoney, Property 5: Pour toute opération valide, une transaction est enregistrée avec solde_avant et solde_apres corrects`

- [ ] 5. Checkpoint — Tests du service de base
  - Vérifier que tous les tests passent : `cd apps/backend && npx jest --runInBand --testPathPattern=walletService`
  - Demander confirmation à l'utilisateur avant de continuer.

- [ ] 6. Implémenter le WalletService — demandes de complément de fonds
  - Implémenter `soumettreDemandeComplement(structureId, input)` dans `walletService.ts` :
    - Valider `montant_demande > 0` → `WALLET_INVALID_AMOUNT`
    - Valider `adresse_collecte` et `contact` non vides → `WALLET_MISSING_FIELDS`
    - `INSERT INTO wallet_demandes` avec statut `en_attente`
  - Implémenter `updateDemandeStatut(demandeId, statut, motif?, adminId?)` :
    - Lire la demande courante
    - Valider la transition selon la machine à états : `en_attente → acceptee | refusee`, `acceptee → collecte_en_cours`, `collecte_en_cours → completee` → `WALLET_INVALID_TRANSITION`
    - Si transition vers `completee` : exécuter `recharge` du wallet dans la même transaction SQL avec type `credit_demande`
    - `UPDATE wallet_demandes SET statut, motif_refus, updated_at`
  - Implémenter `getDemandes(structureId)` et `getAllDemandes()` : SELECT sur wallet_demandes
  - _Exigences : 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 5.1_

  - [ ]* 6.1 Test de propriété — machine à états des demandes
    - **Propriété 7 : Machine à états des demandes**
    - Générer des paires (statut_courant, nouveau_statut) et vérifier que seules les transitions valides sont acceptées, toutes les autres retournent `WALLET_INVALID_TRANSITION`
    - **Valide : Exigences 4.4, 4.9**
    - `// Feature: wallet-restomoney, Property 7: Seules les transitions de statut valides sont acceptées`

  - [ ]* 6.2 Test de propriété — crédit lors de complétion de demande
    - **Propriété 8 : Crédit lors de complétion de demande**
    - Générer des demandes avec montants aléatoires, compléter la demande, vérifier `solde_après = solde_avant + montant_demande`
    - **Valide : Exigences 4.7**
    - `// Feature: wallet-restomoney, Property 8: Pour toute demande completée, solde_après = solde_avant + montant_demande`

- [ ] 7. Créer les routes backend
  - Créer `apps/backend/src/routes/admin/wallets.ts` avec `authenticate + requireAdmin` :
    - `GET /` : liste tous les wallets avec solde par structure
    - `GET /:structureId` : détail wallet
    - `POST /:structureId/recharge` : appelle `WalletService.recharge` (Zod: `{ montant: z.number().int().positive() }`)
    - `GET /transactions` : historique global paginé, query param `structureId` optionnel
    - `GET /demandes` : toutes les demandes
    - `PATCH /demandes/:id/statut` : changer statut (Zod: `{ statut, motif? }`)
  - Créer `apps/backend/src/routes/wallet.ts` avec `authenticate + structureScope` :
    - `GET /` : solde + info wallet
    - `GET /transactions` : historique paginé de la structure
    - `POST /payer` : appelle `WalletService.debiter` (Zod: `{ montant, password }`)
    - `GET /demandes` : demandes de la structure
    - `POST /demandes` : soumettre une demande (Zod: `DemandeInput`)
  - Brancher les deux routers dans `apps/backend/src/index.ts`
  - _Exigences : 2.4, 3.4, 4.1, 5.2, 5.3, 6.1, 6.2, 6.5, 7.4_

  - [ ]* 7.1 Tests unitaires des routes
    - Tester avec Supertest : accès admin routes wallet sans token admin → 403, accès structure routes admin → 403
    - Tester recharge avec montant invalide → 400, débit avec solde insuffisant → 422

- [ ] 8. Checkpoint — API backend complète
  - Vérifier que tous les tests passent : `cd apps/backend && npx jest --runInBand`
  - Demander confirmation à l'utilisateur avant de continuer.

- [ ] 9. Frontend — Page wallet structure
  - Créer `apps/frontend/app/wallet/page.tsx` :
    - Afficher solde courant en FCFA
    - Afficher liste paginée des transactions (type, montant, solde_avant/après, date)
    - Bouton "Payer X F depuis mon compte" avec modal : saisie montant + confirmation mot de passe
    - Section "Mes demandes de fonds" : liste des demandes avec statut badge coloré
    - Bouton "Nouvelle demande" ouvrant un formulaire : montant, adresse (texte), contact, notes
  - Utiliser `apiFetch` vers `/wallet`, `/wallet/transactions`, `/wallet/demandes`, `/wallet/payer`, POST `/wallet/demandes`
  - Ajouter le lien "Wallet" dans la page d'accueil structure (si elle existe) ou dans la navigation
  - _Exigences : 3.1, 3.4, 4.1, 5.2, 5.3, 6.2, 6.4, 6.5_

- [ ] 10. Frontend — Page admin wallets
  - Créer `apps/frontend/app/admin/wallets/page.tsx` :
    - Tableau listant toutes les structures avec leur solde courant
    - Bouton "Recharger" par structure ouvrant un modal : saisie montant + confirmation
    - Section "Demandes en attente" : liste des demandes avec statut, adresse, contact, montant
    - Boutons d'action par demande : "Accepter", "Démarrer collecte", "Confirmer réception", "Refuser" (avec champ motif)
    - Onglet "Historique global" avec tableau paginé de toutes les transactions filtrable par structure
  - Utiliser `apiFetch` vers `/admin/wallets`, `/admin/wallets/:id/recharge`, `/admin/wallets/demandes`, `/admin/wallets/demandes/:id/statut`
  - Ajouter "Wallets" dans la liste `navLinks` de `apps/frontend/app/admin/page.tsx`
  - _Exigences : 2.1, 2.3, 4.5, 4.6, 4.7, 4.8, 6.1, 6.3, 6.4_

- [ ] 11. Intégration — Création automatique du wallet
  - Modifier `apps/backend/src/services/structureService.ts` dans la méthode `create` :
    - Ouvrir une transaction SQL (`client = pool.connect()`, `BEGIN`)
    - Créer la structure
    - Appeler `WalletService.createWalletForStructure(structureId, client)` dans la même transaction
    - `COMMIT`
  - S'assurer que la suppression d'une structure (CASCADE) supprime aussi son wallet
  - _Exigences : 1.1, 1.4_

- [ ] 12. Checkpoint final — Vérification complète
  - Vérifier que tous les tests passent : `cd apps/backend && npx jest --runInBand`
  - Vérifier que le frontend compile sans erreur : `cd apps/frontend && npx next build`
  - Demander confirmation à l'utilisateur que les fonctionnalités sont opérationnelles.

---

## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être ignorées pour un MVP rapide.
- Chaque tâche référence les exigences correspondantes pour la traçabilité.
- Les tests de propriétés nécessitent l'ajout de `fast-check` en devDependency : `npm install --save-dev fast-check` dans `apps/backend`.
- La bibliothèque `fast-check` s'intègre nativement avec Jest (TypeScript) sans configuration supplémentaire.
- Les transactions SQL utilisent `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` selon le pattern existant dans le projet.
- La vérification du mot de passe lors du débit utilise `bcrypt.compare` sur le `password_hash` de la table `structures`, comme dans `authService.ts`.
