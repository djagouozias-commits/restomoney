# Implementation Plan: Plat Variantes

## Overview

Ce plan couvre l'implémentation complète de la fonctionnalité Plat Variantes : migration DB, service backend, routes API admin et employé, gestion des variantes dans les commandes, interface admin inline, et interface employé avec sélection de variante. Les tâches sont ordonnées du bas de la pile vers le haut (DB → backend → frontend).

## Tasks

- [ ] 1. Migration DB — table `plat_variantes` + enrichissement `lignes_commande`
  - [ ] 1.1 Créer `apps/backend/src/db/migrations/013_create_plat_variantes.sql`
    - Créer la table `plat_variantes` : `id UUID PRIMARY KEY`, `plat_id UUID NOT NULL REFERENCES plats(id) ON DELETE CASCADE`, `libelle TEXT NOT NULL`, `prix NUMERIC(10,2) NOT NULL CHECK (prix > 0)`, `position SMALLINT NOT NULL DEFAULT 1`, `created_at TIMESTAMPTZ DEFAULT NOW()`, contrainte `UNIQUE (plat_id, position)`
    - Créer l'index `idx_plat_variantes_plat_id ON plat_variantes(plat_id)`
    - Insérer une variante "Standard" pour chaque plat existant : `INSERT INTO plat_variantes (plat_id, libelle, prix, position) SELECT id, 'Standard', prix, 1 FROM plats ON CONFLICT (plat_id, position) DO NOTHING`
    - Ajouter `variante_id UUID REFERENCES plat_variantes(id)` sur `lignes_commande` : `ALTER TABLE lignes_commande ADD COLUMN IF NOT EXISTS variante_id UUID REFERENCES plat_variantes(id)`

- [ ] 2. `PlatService` — méthodes variantes + enrichissement `list`/`getById`/`create`
  - [ ] 2.1 Ajouter `listVariantes(platId)` : `SELECT id, libelle, prix, position FROM plat_variantes WHERE plat_id = $1 ORDER BY position ASC`
  - [ ] 2.2 Ajouter `createVariante(platId, { libelle, prix })` : calculer `position = (SELECT COALESCE(MAX(position),0)+1 FROM plat_variantes WHERE plat_id = $1)`, insérer, retourner la ressource
  - [ ] 2.3 Ajouter `updateVariante(platId, varianteId, data)` : vérifier l'appartenance au plat (404 si absente), mettre à jour `libelle`/`prix`, si `position = 1` exécuter `UPDATE plats SET prix = $1 WHERE id = $2`, retourner la ressource mise à jour
  - [ ] 2.4 Ajouter `deleteVariante(platId, varianteId)` : vérifier l'appartenance, compter `SELECT COUNT(*) FROM plat_variantes WHERE plat_id = $1`, si `count <= 1` lever `AppError('LAST_VARIANTE_ERROR', 'Impossible de supprimer la dernière variante', 409)`, sinon `DELETE FROM plat_variantes WHERE id = $1`
  - [ ] 2.5 Modifier `list()` : charger tous les plats, extraire `platIds`, `SELECT id, plat_id, libelle, prix, position FROM plat_variantes WHERE plat_id = ANY($1) ORDER BY plat_id, position`, attacher `variantes[]` à chaque plat (2 requêtes max)
  - [ ] 2.6 Modifier `getById(id)` : ajouter une requête `SELECT ... FROM plat_variantes WHERE plat_id = $1 ORDER BY position` et attacher `variantes[]`
  - [ ] 2.7 Modifier `create(data)` : après insertion du plat, insérer automatiquement `INSERT INTO plat_variantes (plat_id, libelle, prix, position) VALUES ($1, 'Standard', $2, 1)` dans la même transaction (utiliser `pool.connect()` + `BEGIN/COMMIT`)

- [ ] 3. Routes admin variantes — `apps/backend/src/routes/admin/plats.ts`
  - [ ] 3.1 Ajouter le schéma Zod `VarianteSchema = z.object({ libelle: z.string().min(1).max(255), prix: z.coerce.number().positive() })`
  - [ ] 3.2 Ajouter `GET /:id/variantes` → `res.json(await PlatService.listVariantes(req.params.id))`
  - [ ] 3.3 Ajouter `POST /:id/variantes` → valider `VarianteSchema`, `PlatService.createVariante(req.params.id, data)`, retourner `res.status(201).json(...)`
  - [ ] 3.4 Ajouter `PUT /:id/variantes/:varianteId` → valider `VarianteSchema.partial()`, `PlatService.updateVariante(req.params.id, req.params.varianteId, data)`
  - [ ] 3.5 Ajouter `DELETE /:id/variantes/:varianteId` → `PlatService.deleteVariante(req.params.id, req.params.varianteId)`, retourner `res.json({ ok: true })`

- [ ] 4. Route `GET /creneaux/plats-du-jour` enrichie avec variantes
  - [ ] 4.1 Modifier `apps/backend/src/routes/creneaux.ts` : après la requête principale, extraire les `platIds`, charger `SELECT id, plat_id, libelle, prix, position FROM plat_variantes WHERE plat_id = ANY($1) ORDER BY plat_id, position`, grouper par `plat_id`, attacher `variantes[]` à chaque plat dans le résultat
  - [ ] 4.2 Conserver le champ `plat.prix` inchangé dans la réponse pour rétrocompatibilité

- [ ] 5. Route `POST /commandes` — gestion `variante_id`
  - [ ] 5.1 Étendre `LigneCommandeSchema` dans `apps/backend/src/routes/commandes.ts` : ajouter `variante_id: z.string().uuid().optional()`
  - [ ] 5.2 Étendre `LigneCommandeInput` dans `apps/backend/src/services/commandeService.ts` : ajouter `variante_id?: string`
  - [ ] 5.3 Modifier la boucle de validation de `CommandeService.create` pour les lignes `type === 'plat'` :
    - `SELECT id, libelle, prix FROM plat_variantes WHERE plat_id = $1 ORDER BY position`
    - Si `variante_id` fourni : vérifier `variantes.find(v => v.id === variante_id)`, sinon `AppError('VALIDATION_ERROR', 'variante_id invalide', 422)` ; utiliser `variante.prix` comme `prixUnitaire`
    - Si `variante_id` absent et `variantes.length === 1` : auto-sélection, `prixUnitaire = variantes[0].prix`, `varianteId = variantes[0].id`
    - Si `variante_id` absent et `variantes.length > 1` : `AppError('VARIANTE_REQUIRED', 'Veuillez sélectionner une variante pour ce plat', 422)`
  - [ ] 5.4 Dans l'INSERT de `lignes_commande`, ajouter la colonne `variante_id` avec la valeur résolue
  - [ ] 5.5 Modifier `CommandeService.getById` : ajouter `lc.variante_id, pv.libelle as variante_libelle` au SELECT avec `LEFT JOIN plat_variantes pv ON pv.id = lc.variante_id`

- [ ] 6. Page admin plats — section variantes inline
  - [ ] 6.1 Ajouter l'interface `PlatVariante { id: string; libelle: string; prix: number; position: number }` et étendre le type `Plat` avec `variantes?: PlatVariante[]` dans `apps/frontend/app/admin/plats/page.tsx`
  - [ ] 6.2 Ajouter les états locaux : `addingVarianteFor: string | null`, `newVarianteLibelle: string`, `newVariantePrix: string`, `editingVariante: (PlatVariante & { platId: string }) | null`
  - [ ] 6.3 Implémenter la section variantes dans chaque carte plat : liste des variantes (libellé, prix formaté, boutons Modifier/Supprimer), bouton "Supprimer" rendu `disabled` et tooltip si `plat.variantes.length <= 1`
  - [ ] 6.4 Implémenter le formulaire d'ajout inline : s'affiche sous la carte quand `addingVarianteFor === plat.id`, champs `libelle` et `prix`, bouton "Valider" → `POST /admin/plats/:id/variantes` puis mise à jour de `plats` en state, bouton "Annuler"
  - [ ] 6.5 Implémenter la modification inline : cliquer "Modifier" met `editingVariante = { ...variante, platId }`, les champs deviennent des inputs, bouton "Enregistrer" → `PUT /admin/plats/:id/variantes/:varianteId` + mise à jour optimiste du state
  - [ ] 6.6 Implémenter la suppression : `DELETE /admin/plats/:id/variantes/:varianteId`, filtrer la variante du state sans rechargement complet
  - [ ] 6.7 Afficher un message d'erreur inline (state `varianteError: string | null`) capturant les codes `LAST_VARIANTE_ERROR` et `VALIDATION_ERROR` reçus de l'API

- [ ] 7. `DailyDishCard.tsx` — sélection de variante
  - [ ] 7.1 Ajouter les interfaces `Variante { id: string; libelle: string; prix: number }` et étendre `Plat` avec `variantes?: Variante[]` dans `apps/frontend/components/employee/DailyDishCard.tsx`
  - [ ] 7.2 Ajouter l'état local `selectedVariante: Variante | null` initialisé à `null`
  - [ ] 7.3 Ajouter le rendu conditionnel multi-variantes : si `plat.variantes && plat.variantes.length > 1`, afficher un groupe de boutons `{prix.toLocaleString('fr-FR')} FCFA — {libellé}` avec classe de surbrillance si `selectedVariante?.id === variante.id`
  - [ ] 7.4 Désactiver le bouton "+ Ajouter" quand `plat.variantes && plat.variantes.length > 1 && selectedVariante === null` via `disabled={...}`
  - [ ] 7.5 Modifier `doAdd(jetable)` : utiliser `selectedVariante?.prix ?? plat.prix` comme `prix`, inclure `variante_id: selectedVariante?.id ?? plat.variantes?.[0]?.id`, `variante_libelle: selectedVariante?.libelle ?? plat.variantes?.[0]?.libelle`
  - [ ] 7.6 Mettre à jour la `key` du `CartItem` : `` `${plat.id}_${varianteId}_${jetable ? 'jetable' : 'normal'}` ``

- [ ] 8. `CartContext.tsx` — extension `CartItem` avec variante
  - [ ] 8.1 Ajouter `variante_id?: string` et `variante_libelle?: string` à l'interface `CartItem` dans `apps/frontend/lib/CartContext.tsx`
  - [ ] 8.2 Vérifier que `calcTotal`, `cartReducer` et `CartProvider` ne nécessitent aucune modification logique (les nouveaux champs sont additionnels et non utilisés dans les calculs existants)

- [ ] 9. Vérification TypeScript globale
  - [ ] 9.1 Lancer `tsc --noEmit` dans `apps/backend` et corriger toutes les erreurs liées à `variante_id`, `PlatVariante`, `LigneCommandeInput`, `PlatWithVariantes`
  - [ ] 9.2 Lancer `tsc --noEmit` dans `apps/frontend` et corriger toutes les erreurs liées à `CartItem.variante_id`, `DailyDishCard.Plat.variantes`, `PlatVariante`

## Notes

- La migration `013` est rétrocompatible : le champ `prix` de la table `plats` est conservé et resynchronisé automatiquement lors de toute modification de la variante à `position = 1`.
- La bibliothèque PBT choisie est **fast-check** pour les tests backend (TypeScript natif). Chaque test property doit tourner avec minimum 100 itérations (`fc.assert(fc.property(...), { numRuns: 100 })`).
- Les tests property backend s'appuient sur une base PostgreSQL de test dédiée (pas de mocks DB pour les tests de persistance).
- Les tests property frontend (`CartContext`, `DailyDishCard`) utilisent des mocks React (vitest + @testing-library/react) avec fast-check pour la génération des données.
- La `key` d'un `CartItem` avec variante change de format : `` `${platId}_${varianteId}_${jetable}` `` — cela garantit qu'une même variante en mode jetable et non-jetable est comptée séparément.
- L'auto-sélection (plat mono-variante sans `variante_id`) est gérée côté backend (commandeService) ET côté frontend (DailyDishCard) de manière indépendante et cohérente.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2", "8"] },
    { "wave": 3, "tasks": ["3", "4", "5"] },
    { "wave": 4, "tasks": ["6", "7"] },
    { "wave": 5, "tasks": ["9"] }
  ]
}
```
