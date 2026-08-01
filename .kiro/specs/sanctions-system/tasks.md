# Implementation Plan: Sanctions System

## Overview

Implémentation du système de sanctions multi-niveaux en TypeScript (Node.js + Express + PostgreSQL), intégré au cron de retards existant. Les tâches couvrent : migrations DB, service métier, modification du cron, routes admin REST, enregistrement dans `index.ts`, page frontend Next.js, et tests (PBT fast-check + intégration).

---

## Tasks

- [x] 1. Créer les migrations PostgreSQL
  - [x] 1.1 Migration 009 — table `parametres_sanctions`
    - Créer `009_create_parametres_sanctions.sql` dans `src/db/migrations/`
    - Définir la table avec colonnes `niveau` (INT PK CHECK 1–4), `min_minutes`, `max_minutes` (nullable), `reduction_pct` (CHECK 0–100), `emettre_bon`
    - Insérer les 3 niveaux par défaut : Niveau 1 (5–9 min, 50 %, false), Niveau 2 (10–19 min, 100 %, false), Niveau 3 (20+ min, 100 %, true)
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Migration 010 — table `bons_reduction`
    - Créer `010_create_bons_reduction.sql` dans `src/db/migrations/`
    - Définir la table avec colonnes `id` (UUID PK), `structure_id` (UUID FK → structures), `valeur_pct` (INT CHECK 1–100), `emis_le`, `expire_le`, `utilise` (BOOLEAN DEFAULT false), `commande_id_source` (UUID nullable FK → commandes)
    - Créer les index sur `structure_id`, `expire_le`, `utilise`
    - _Requirements: 4.1, 4.6_

  - [x] 1.3 Migration 011 — table `historique_sanctions`
    - Créer `011_create_historique_sanctions.sql` dans `src/db/migrations/`
    - Définir la table avec colonnes `id` (UUID PK), `commande_id` (UUID FK), `structure_id` (UUID), `minutes_retard` (INT), `niveau` (INT nullable), `montant_final` (NUMERIC(10,2)), `applique_le` (TIMESTAMPTZ DEFAULT NOW())
    - _Requirements: 6.3_

- [ ] 2. Implémenter `sanctionService.ts`
  - [x] 2.1 Définir les interfaces TypeScript et la structure du service
    - Créer `src/services/sanctionService.ts`
    - Déclarer les interfaces `ParametreSanction`, `ResultatSanction`, `HistoriqueSanction`, `BonReduction`
    - Réutiliser le type `CommandeEnRetard` retourné par `retardService.ts`
    - Exporter l'objet `SanctionService` avec les méthodes listées dans le design
    - _Requirements: 2.1, 3.1_

  - [x] 2.2 Implémenter `calculateMinutesRetard` et `findNiveau`
    - `calculateMinutesRetard(creneau: string): number` — calcule la différence en minutes entières entre `Date.now()` et le créneau TIME de la commande (même jour)
    - `findNiveau(minutesRetard: number): Promise<ParametreSanction | null>` — requête SELECT sur `parametres_sanctions` ; retourne `null` si `minutesRetard < 5`
    - _Requirements: 2.1, 2.2_

  - [ ]* 2.3 Écrire le test de propriété — Property 1 : unicité du niveau
    - **Property 1: Unicite du niveau de sanction**
    - Installer `fast-check` : `npm install --save-dev fast-check`
    - Créer `src/services/__tests__/sanctionService.property.test.ts`
    - Générateur : `fc.integer({ min: 0, max: 1000 })`
    - Assertion : pour chaque `minutes`, au plus un niveau satisfait `min_minutes <= minutes && (max_minutes === null || minutes < max_minutes)`
    - Tag : `// Feature: sanctions-system, Property 1: Unicite du niveau de sanction`
    - **Validates: Requirements 2.5**

  - [ ]* 2.4 Écrire le test de propriété — Property 2 : cohérence du lookup
    - **Property 2: Coherence du lookup de niveau**
    - Générateur : `fc.integer({ min: 0, max: 1000 })`
    - Assertion : si `findNiveau` retourne un niveau `N`, alors `N.min_minutes <= minutes` ET (`N.max_minutes === null` ou `minutes < N.max_minutes`) ; si `minutes < 5`, résultat `null`
    - Tag : `// Feature: sanctions-system, Property 2: Coherence du lookup de niveau`
    - **Validates: Requirements 2.1, 2.2**

  - [x] 2.5 Implémenter `calculerMontantFinal`
    - `calculerMontantFinal(montantTotal: number, reductionPct: number): number`
    - Formule : `Math.round(montantTotal * (1 - reductionPct / 100) * 100) / 100`
    - Résultat toujours ≥ 0 (Math.max avec 0)
    - _Requirements: 2.3, 2.4_

  - [ ]* 2.6 Écrire le test de propriété — Property 3 : calcul du montant final
    - **Property 3: Calcul du montant final**
    - Générateur : `fc.tuple(fc.float({ min: 0, max: 9999, noNaN: true }), fc.integer({ min: 0, max: 100 }))`
    - Assertion : résultat == `Math.round(total * (1 - pct / 100) * 100) / 100` ET résultat ≥ 0
    - Tag : `// Feature: sanctions-system, Property 3: Calcul du montant final`
    - **Validates: Requirements 2.3, 2.4**

  - [x] 2.7 Implémenter `appliquerSanction` (logique idempotente)
    - `appliquerSanction(commande: CommandeEnRetard): Promise<ResultatSanction | null>`
    - Vérifier `commande.penalite === true` → retourner `null` immédiatement (idempotence)
    - Calculer `minutesRetard` via `calculateMinutesRetard`
    - Appeler `findNiveau` ; si `null` et `minutesRetard >= 5` → `console.warn` + retourner `null`
    - `UPDATE commandes SET penalite=true, montant_final=... WHERE id=...`
    - Insérer dans `historique_sanctions`
    - `console.log` avec les 5 champs requis (requirement 6.1)
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 6.1_

  - [ ]* 2.8 Écrire le test de propriété — Property 5 : idempotence
    - **Property 5: Idempotence de l'application des sanctions**
    - Mocker la DB pour simuler une commande avec `penalite=true`
    - Assertion : appeler `appliquerSanction` deux fois → `montant_final` inchangé, aucun nouveau bon créé
    - Tag : `// Feature: sanctions-system, Property 5: Idempotence de l application des sanctions`
    - **Validates: Requirements 3.5**

  - [x] 2.9 Implémenter `emettresBon` et la logique niveau 3
    - Méthode interne `emettresBon(commandeId: string, structureId: string): Promise<string>` — INSERT dans `bons_reduction` avec `expire_le = NOW() + INTERVAL '30 days'`, retourner `bon.id`
    - Dans `appliquerSanction`, si `niveau.emettre_bon === true`, appeler `emettresBon`
    - `console.log` avec `bon_id`, `structure_id`, `expire_le` (requirement 6.2)
    - _Requirements: 3.4, 4.1, 4.2, 4.4, 6.2_

  - [ ]* 2.10 Écrire le test de propriété — Property 4 : émission conditionnelle de bon
    - **Property 4: Emission conditionnelle de bon**
    - Générateur : `fc.boolean()` pour `emettre_bon` + commande générée
    - Assertion : si `emettre_bon = true` → exactement 1 INSERT dans `bons_reduction` ; si `false` → 0 INSERT
    - Tag : `// Feature: sanctions-system, Property 4: Emission conditionnelle de bon`
    - **Validates: Requirements 3.4, 4.4**

  - [ ]* 2.11 Écrire le test de propriété — Property 8 : durée d'expiration 30 jours
    - **Property 8: Duree d expiration des bons emis**
    - Générateur : timestamp d'émission aléatoire
    - Assertion : `expire_le - emis_le === 30 * 24 * 3600 * 1000` (ms) à ±1 seconde près
    - Tag : `// Feature: sanctions-system, Property 8: Duree d expiration des bons emis`
    - **Validates: Requirements 4.2**

  - [x] 2.12 Implémenter `appliquerSanctions` (batch avec isolation d'erreurs)
    - `appliquerSanctions(commandes: CommandeEnRetard[]): Promise<void>`
    - Boucle `for...of` avec `try/catch` individuel par commande
    - En cas d'erreur sur une commande : `console.error('[SanctionService] Erreur commande ${id}:', err)` + continuer
    - _Requirements: 3.6_

  - [x] 2.13 Implémenter les méthodes CRUD admin (`getParametres`, `updateParametre`, `getHistorique`, `getBons`)
    - `getParametres()` : SELECT * FROM parametres_sanctions ORDER BY niveau
    - `updateParametre(niveau, patch)` : UPDATE avec validation préalable ; retourner 404 si 0 lignes affectées
    - `getHistorique(filters)` : SELECT avec WHERE conditionnel sur `date` et `structure_id`
    - `getBons(filters)` : SELECT avec WHERE conditionnel sur `structure_id` et `date`
    - _Requirements: 1.3, 5.1, 5.5, 6.3_

  - [ ]* 2.14 Écrire le test de propriété — Property 10 : filtrage de l'historique
    - **Property 10: Filtrage de l historique**
    - Générateur : lots de sanctions avec dates/structures variées
    - Assertion : tous les enregistrements retournés satisfont le filtre appliqué (aucun hors-filtre)
    - Tag : `// Feature: sanctions-system, Property 10: Filtrage de l historique`
    - **Validates: Requirements 6.3**

- [x] 3. Modifier `retardCron.ts` pour appeler `sanctionService`
  - [x] 3.1 Intégrer `SanctionService.appliquerSanctions` dans le cron
    - Dans `src/cron/retardCron.ts`, importer `SanctionService` depuis `'../services/sanctionService'`
    - Après `const retards = await RetardService.detecterRetards()`, ajouter `await SanctionService.appliquerSanctions(retards)`
    - Placer l'appel AVANT la boucle SSE (les sanctions sont appliquées, puis les clients notifiés)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 4. Checkpoint — Migrations et service
  - Vérifier que les migrations 009, 010, 011 s'appliquent sans erreur (`npm run dev` lance `runMigrations()`)
  - Vérifier que les tests unitaires et propriétés du service passent (`npm test -- --testPathPattern=sanctionService`)
  - S'assurer que le cron démarre sans erreur TypeScript
  - Demander à l'utilisateur si des ajustements sont nécessaires avant de continuer.

- [x] 5. Créer les routes admin `sanctions.ts`
  - [x] 5.1 Implémenter `GET /parametres` et `PATCH /parametres/:niveau`
    - Créer `src/routes/admin/sanctions.ts`
    - Appliquer `router.use(authenticate, requireAdmin)` comme les autres routes admin
    - `GET /` → `SanctionService.getParametres()` → `res.json(rows)`
    - `PATCH /:niveau` → valider le corps avec Zod (schéma : `reduction_pct` ∈ [0, 100], `min_minutes` ≥ 0) → `AppError('VALIDATION_ERROR', ..., 422)` si invalide → `SanctionService.updateParametre(niveau, body)` → `res.json(updated)`
    - _Requirements: 1.3, 1.4, 1.5, 5.1_

  - [ ]* 5.2 Écrire le test de propriété — Property 6 : validation PATCH
    - **Property 6: Validation des parametres de sanction**
    - Créer `src/routes/admin/__tests__/sanctions.integration.test.ts`
    - Générateur : `fc.integer().filter(n => n < 0 || n > 100)` pour `reduction_pct`
    - Assertion : PATCH avec valeur invalide → HTTP 422 ; valeur valide → HTTP 200 + valeur persistée
    - Tag : `// Feature: sanctions-system, Property 6: Validation des parametres de sanction`
    - **Validates: Requirements 1.4, 1.5**

  - [x] 5.3 Implémenter `GET /bons` et `GET /historique`
    - `GET /bons` → lire query params `structure_id` et `date` → `SanctionService.getBons(filters)` → `res.json(rows)`
    - `GET /historique` → lire query params `date` et `structure_id` → `SanctionService.getHistorique(filters)` → `res.json(rows)`
    - _Requirements: 5.5, 6.3_

  - [ ]* 5.4 Écrire le test d'intégration des routes — authentification et flux complet
    - Dans `sanctions.integration.test.ts`, ajouter des tests d'exemples :
      - `GET /parametres` sans token → 401
      - `GET /parametres` avec token admin valide → 200 + tableau de 3 niveaux
      - `PATCH /parametres/1` avec token admin + body valide → 200 + valeur persistée
      - `GET /bons` avec filtre `structure_id` → uniquement les bons de cette structure
    - _Requirements: 1.3, 5.4_

  - [ ]* 5.5 Écrire le test de propriété — Property 7 : rejet des bons expirés
    - **Property 7: Expiration des bons de reduction**
    - Générateur : bon avec `expire_le` dans le passé (date aléatoire antérieure à `Date.now()`)
    - Assertion : tentative d'utilisation → HTTP 422
    - Tag : `// Feature: sanctions-system, Property 7: Expiration des bons de reduction`
    - **Validates: Requirements 4.5**

- [x] 6. Enregistrer la route dans `index.ts`
  - [x] 6.1 Ajouter l'import et `app.use` pour le router sanctions
    - Dans `src/index.ts`, importer `sanctionsRouter` depuis `'./routes/admin/sanctions'`
    - Ajouter `app.use(\`${API}/admin/sanctions\`, sanctionsRouter)` dans le bloc Admin, après `recapRouter`
    - _Requirements: 1.3, 5.1, 5.5, 6.3_

- [ ] 7. Checkpoint — Routes backend
  - Vérifier que `GET /api/v1/admin/sanctions/parametres` retourne les 3 niveaux par défaut
  - Vérifier que `PATCH /api/v1/admin/sanctions/parametres/1` avec body invalide retourne 422
  - Vérifier que les tests d'intégration routes passent (`npm test -- --testPathPattern=sanctions.integration`)
  - Demander à l'utilisateur si des ajustements sont nécessaires avant de continuer.

- [x] 8. Créer la page frontend `app/admin/sanctions/page.tsx`
  - [x] 8.1 Implémenter le tableau éditable des paramètres de sanction
    - Créer `apps/frontend/app/admin/sanctions/page.tsx` avec `'use client'`
    - Utiliser `useState` pour stocker les 4 niveaux et l'état de chargement/erreur
    - `useEffect` → `apiFetch<ParametreSanction[]>('/admin/sanctions/parametres')` au montage
    - Afficher un tableau avec colonnes `Niveau`, `Min (min)`, `Max (min)`, `Réduction (%)`, `Émettre bon`, `Action`
    - Chaque cellule éditable inline (`<input type="number" />`), bouton "Enregistrer" par ligne
    - On submit : `apiFetch('/admin/sanctions/parametres/:niveau', { method: 'PATCH', body: row })` ; afficher spinner pendant la requête, message de succès ou erreur sans perdre les valeurs saisies
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 8.2 Implémenter la liste des bons de réduction (lecture seule)
    - Dans la même page, ajouter une section "Bons de réduction émis"
    - `useEffect` → `apiFetch<BonReduction[]>('/admin/sanctions/bons')` au montage
    - Afficher un tableau en lecture seule : colonnes Structure, Valeur (%), Émis le, Expire le, Statut (`utilise` ou non)
    - Gérer les états loading et error avec les composants Tailwind existants
    - _Requirements: 5.5_

- [ ] 9. Checkpoint final — Ensemble du système
  - Vérifier que la page frontend se charge sans erreur TypeScript (`npm run build` côté frontend)
  - Vérifier que la suite complète de tests backend passe (`npm test`)
  - S'assurer que le cron détecte les retards ET applique les sanctions dans le bon ordre
  - Demander à l'utilisateur si des ajustements sont nécessaires.

---

## Notes

- Les tâches marquées `*` sont optionnelles (tests) et peuvent être passées pour aller plus vite
- Le framework de test est **Jest** + **ts-jest** (déjà configuré dans `package.json`). Installer `fast-check` pour les PBT : `npm install --save-dev fast-check`
- `penaliteService.ts` est conservé sans modification pour la rétrocompatibilité des routes manuelles
- La migration `011` (historique_sanctions) est recommandée par le design mais peut être différée sans bloquer les fonctions principales
- Les tests d'intégration routes nécessitent une DB de test ou un mock de `pool.query`
- Chaque propriété PBT est taguée `// Feature: sanctions-system, Property N:` pour la traçabilité

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.5"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.6", "2.7"] },
    { "id": 4, "tasks": ["2.8", "2.9", "2.12"] },
    { "id": 5, "tasks": ["2.10", "2.11", "2.13", "3.1"] },
    { "id": 6, "tasks": ["2.14", "5.1"] },
    { "id": 7, "tasks": ["5.2", "5.3"] },
    { "id": 8, "tasks": ["5.4", "5.5", "6.1"] },
    { "id": 9, "tasks": ["8.1"] },
    { "id": 10, "tasks": ["8.2"] }
  ]
}
```
