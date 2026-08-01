import pool from '../db/pool';
import { AppError } from '../utils/errors';
import WalletService from './walletService';

const CRENEAUX = ['09:00', '12:00', '16:00', '20:00'];

export interface SelectionOptionInput {
  composant_id: string;
  option_id: string;
}

export interface LigneCommandeInput {
  type: 'plat' | 'menu';
  plat_id?: string;
  menu_complet_id?: string;
  quantite: number;
  selections_options?: SelectionOptionInput[];
  jetable?: boolean;
  variante_id?: string;
}

export interface CommandeInput {
  creneau: string; // HH:MM
  lignes: LigneCommandeInput[];
  mode_paiement: 'especes' | 'wallet';
  password?: string; // requis si mode_paiement === 'wallet'
}

/**
 * Vérifie que le créneau est disponible.
 * - Aujourd'hui : doit être ≥ 60 min dans le futur.
 * - Si plus aucun créneau dispo aujourd'hui (après 20h) : le créneau est
 *   pour le lendemain, donc toujours valide.
 */
function validerCreneau(creneauStr: string): void {
  const now = new Date();

  // Vérifier si au moins un créneau est encore dispo aujourd'hui
  const anyAvailableToday = CRENEAUX.some((c) => {
    const [h, m] = c.split(':').map(Number);
    const creneau = new Date(now);
    creneau.setHours(h, m, 0, 0);
    return (creneau.getTime() - now.getTime()) / 60000 >= 60;
  });

  if (!anyAvailableToday) {
    // Mode lendemain : tous les créneaux sont valides
    return;
  }

  // Mode aujourd'hui : règle des 60 minutes
  const [h, m] = creneauStr.split(':').map(Number);
  const creneau = new Date(now);
  creneau.setHours(h, m, 0, 0);

  const diffMinutes = (creneau.getTime() - now.getTime()) / 60000;
  if (diffMinutes < 60) {
    throw new AppError(
      'CRENEAU_NOT_AVAILABLE',
      `Le créneau ${creneauStr} n'est plus disponible (règle des 60 minutes)`,
      422,
    );
  }
}

export const CommandeService = {
  /**
   * Crée une commande complète avec validation des contraintes métier.
   * Tout est dans une transaction.
   *
   * Requirements: 6.2, 6.3, 6.6, 7.3, 7.5, 7.7, 5.4
   */
  async create(
    structureId: string,
    payload: CommandeInput,
    employeId?: string,
    employeLogin?: string,
    requesterType: 'structure' | 'employe' = 'structure',
  ): Promise<Record<string, unknown>> {
    // 1. Valider créneau
    if (!CRENEAUX.includes(payload.creneau)) {
      throw new AppError('CRENEAU_NOT_AVAILABLE', 'Créneau invalide', 422);
    }
    validerCreneau(payload.creneau);

    // 2. Si paiement wallet : vérifier MDP selon le type de requérant
    if (payload.mode_paiement === 'wallet') {
      if (!payload.password) {
        throw new AppError('WALLET_MISSING_FIELDS', 'Mot de passe requis pour payer depuis le wallet', 422);
      }

      const bcrypt = await import('bcrypt');

      if (requesterType === 'employe' && employeId) {
        // Vérifier le mot de passe de l'employé
        const { rows: empRows } = await pool.query<{ password_hash: string }>(
          'SELECT password_hash FROM employes WHERE id = $1',
          [employeId],
        );
        if (empRows.length === 0) {
          throw new AppError('AUTH_INVALID_CREDENTIALS', 'Employé introuvable', 401);
        }
        const valid = await bcrypt.compare(payload.password, empRows[0].password_hash);
        if (!valid) {
          throw new AppError('AUTH_INVALID_CREDENTIALS', 'Mot de passe incorrect', 401);
        }
      } else {
        // Vérifier le mot de passe de la structure
        const { rows: structRows } = await pool.query<{ password_hash: string }>(
          'SELECT password_hash FROM structures WHERE id = $1',
          [structureId],
        );
        if (structRows.length === 0) {
          throw new AppError('AUTH_INVALID_CREDENTIALS', 'Structure introuvable', 401);
        }
        const valid = await bcrypt.compare(payload.password, structRows[0].password_hash);
        if (!valid) {
          throw new AppError('AUTH_INVALID_CREDENTIALS', 'Mot de passe incorrect', 401);
        }
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let montantTotal = 0;

      // 2. Valider chaque ligne et calculer le montant
      const lignesData: Array<{
        input: LigneCommandeInput;
        prixUnitaire: number;
        varianteId: string | null;
        composantsAChoix?: Array<{ id: string }>;
      }> = [];

      for (const ligne of payload.lignes) {
        if (ligne.type === 'plat') {
          if (!ligne.plat_id) throw new AppError('VALIDATION_ERROR', 'plat_id manquant', 400);
          const { rows } = await client.query(
            'SELECT id, prix, actif FROM plats WHERE id = $1',
            [ligne.plat_id],
          );
          if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Plat introuvable', 404);
          if (!rows[0].actif) throw new AppError('PLAT_INACTIVE', 'Ce plat n\'est plus disponible', 422);

          // Charger les variantes du plat
          const { rows: variantes } = await client.query(
            `SELECT id::text, libelle, prix::float FROM plat_variantes WHERE plat_id = $1 ORDER BY position`,
            [ligne.plat_id],
          );
          let prixUnitaire = parseFloat(rows[0].prix);
          let varianteId: string | null = null;
          if (ligne.variante_id) {
            const v = variantes.find((v: any) => v.id === ligne.variante_id);
            if (!v) throw new AppError('VALIDATION_ERROR', 'variante_id invalide pour ce plat', 422);
            prixUnitaire = parseFloat(v.prix); // utiliser le prix de la variante
            varianteId = v.id;
          } else if (variantes.length === 1) {
            prixUnitaire = parseFloat(variantes[0].prix); // auto-select
            varianteId = variantes[0].id;
          } else if (variantes.length > 1) {
            throw new AppError('VARIANTE_REQUIRED', 'Veuillez sélectionner une variante pour ce plat', 422);
          }

          lignesData.push({ input: ligne, prixUnitaire, varianteId });
          montantTotal += prixUnitaire * ligne.quantite;
        } else {
          if (!ligne.menu_complet_id) throw new AppError('VALIDATION_ERROR', 'menu_complet_id manquant', 400);
          const { rows } = await client.query(
            'SELECT id, prix, actif FROM menus_complets WHERE id = $1',
            [ligne.menu_complet_id],
          );
          if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Menu introuvable', 404);
          if (!rows[0].actif) throw new AppError('PLAT_INACTIVE', 'Ce menu n\'est plus disponible', 422);

          // Valider options obligatoires
          const { rows: composants } = await client.query(
            'SELECT id FROM composants WHERE menu_complet_id = $1 AND a_choix = true',
            [ligne.menu_complet_id],
          );
          const selectionsMap = new Set((ligne.selections_options || []).map((s) => s.composant_id));
          for (const comp of composants) {
            if (!selectionsMap.has(comp.id)) {
              throw new AppError(
                'MENU_OPTION_REQUIRED',
                `Option manquante pour le composant ${comp.id}`,
                422,
              );
            }
          }

          lignesData.push({
            input: ligne,
            prixUnitaire: parseFloat(rows[0].prix),
            varianteId: null,
            composantsAChoix: composants,
          });
          montantTotal += parseFloat(rows[0].prix) * ligne.quantite;
        }
      }

      // 3. Insérer la commande
      const creneauTime = `${payload.creneau}:00`;
      const { rows: cmdRows } = await client.query(
        `INSERT INTO commandes (structure_id, creneau, montant_total, employe_id, employe_login, mode_paiement)
         VALUES ($1, $2::time, $3, $4, $5, $6)
         RETURNING id, structure_id, creneau::text, date_commande::text,
                   statut, penalite, montant_total, mode_paiement, created_at`,
        [structureId, creneauTime, montantTotal, employeId || null, employeLogin || null, payload.mode_paiement],
      );
      const commande = cmdRows[0];

      // 4. Insérer les lignes
      for (const { input, prixUnitaire, varianteId } of lignesData) {
        const { rows: ligneRows } = await client.query(
          `INSERT INTO lignes_commande
             (commande_id, type, plat_id, menu_complet_id, quantite, prix_unitaire, jetable, variante_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            commande.id,
            input.type,
            input.plat_id || null,
            input.menu_complet_id || null,
            input.quantite,
            prixUnitaire,
            input.jetable ?? false,
            varianteId,
          ],
        );
        const ligneId = ligneRows[0].id;

        // 5. Insérer les sélections d'options
        for (const sel of input.selections_options || []) {
          await client.query(
            `INSERT INTO selections_options (ligne_commande_id, composant_id, option_id)
             VALUES ($1, $2, $3)`,
            [ligneId, sel.composant_id, sel.option_id],
          );
        }
      }

      await client.query('COMMIT');

      // Débit wallet APRÈS le commit (hors transaction commande — la commande est déjà enregistrée)
      if (payload.mode_paiement === 'wallet') {
        try {
          await WalletService.debiterPourCommande(structureId, montantTotal, commande.id as string);
        } catch (walletErr) {
          // Si le débit échoue, on le note mais la commande reste valide (évite de bloquer)
          console.error('[CommandeService] Débit wallet échoué après création commande:', walletErr);
        }
      }

      return commande;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Liste les commandes d'une structure (isolation par structureId).
   */
  async listByStructure(structureId: string): Promise<Record<string, unknown>[]> {
    const { rows } = await pool.query(
      `SELECT id, structure_id, creneau::text, date_commande::text,
              statut, penalite, montant_total, montant_final, created_at
       FROM commandes
       WHERE structure_id = $1
       ORDER BY created_at DESC`,
      [structureId],
    );
    return rows;
  },

  /**
   * Retourne une commande avec ses lignes. Applique l'isolation (structureId).
   */
  async getById(id: string, structureId: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      `SELECT id, structure_id, creneau::text, date_commande::text,
              statut, penalite, montant_total, montant_final, statut_updated_at, created_at
       FROM commandes
       WHERE id = $1 AND structure_id = $2`,
      [id, structureId],
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Commande introuvable', 404);

    // Lignes
    const { rows: lignes } = await pool.query(
      `SELECT lc.id, lc.type, lc.plat_id, lc.menu_complet_id, lc.quantite, lc.prix_unitaire,
              lc.jetable, lc.variante_id, pv.libelle as variante_libelle,
              p.nom as plat_nom, m.nom as menu_nom
       FROM lignes_commande lc
       LEFT JOIN plats p ON p.id = lc.plat_id
       LEFT JOIN menus_complets m ON m.id = lc.menu_complet_id
       LEFT JOIN plat_variantes pv ON pv.id = lc.variante_id
       WHERE lc.commande_id = $1`,
      [id],
    );

    // Sélections d'options pour chaque ligne
    for (const ligne of lignes) {
      const { rows: sels } = await pool.query(
        `SELECT so.composant_id, so.option_id, c.nom as composant_nom, o.nom as option_nom
         FROM selections_options so
         JOIN composants c ON c.id = so.composant_id
         JOIN options o ON o.id = so.option_id
         WHERE so.ligne_commande_id = $1`,
        [ligne.id],
      );
      ligne.selections_options = sels;
    }

    return { ...rows[0], lignes };
  },
};

export default CommandeService;
