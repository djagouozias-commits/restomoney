import pool from '../db/pool';
import { AppError } from '../utils/errors';

export interface SignalementInput {
  commande_id: string;
  structure_id: string;
  employe_id?: string | null;
  photo_url: string;
  note?: string | null;
}

export interface SignalementResult {
  id: string;
  commande_id: string;
  heure_signalement: Date;
  retard_minutes: number;
  niveau_sanction: number | null;
  reduction_pct: number | null;
  bon_emis: boolean;
  message: string;
}

export const SignalementService = {
  /**
   * Crée un signalement de retard avec photo horodatée.
   *
   * Logique :
   * 1. Charger la commande pour obtenir le créneau prévu
   * 2. Calculer le retard = NOW() - créneau prévu (en minutes)
   * 3. Si retard <= 0 → pas de retard, signalement ignoré
   * 4. Trouver le niveau de sanction correspondant
   * 5. Appliquer la réduction sur montant_final
   * 6. Émettre un bon de réduction si configuré
   * 7. Enregistrer le signalement
   */
  async createSignalement(input: SignalementInput): Promise<SignalementResult> {
    const { commande_id, structure_id, employe_id, photo_url, note } = input;

    // 1. Charger la commande
    const { rows: cmdRows } = await pool.query(
      `SELECT id, creneau, date_commande, montant_total, statut, structure_id
       FROM commandes WHERE id = $1`,
      [commande_id],
    );
    if (cmdRows.length === 0) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Commande introuvable', 404);
    }
    const cmd = cmdRows[0];

    // Vérifier que la commande appartient à la structure
    if (cmd.structure_id !== structure_id) {
      throw new AppError('AUTH_FORBIDDEN', 'Accès interdit', 403);
    }

    // 2. Calculer le retard en minutes
    // creneau est de type TIME, date_commande est DATE
    const { rows: calcRows } = await pool.query(
      `SELECT EXTRACT(EPOCH FROM (NOW() - ($1::date + $2::time))) / 60 AS retard_minutes`,
      [cmd.date_commande, cmd.creneau],
    );
    const retardMinutes = Math.round(Number(calcRows[0]?.retard_minutes ?? 0));

    // 3. Pas de retard
    if (retardMinutes <= 0) {
      // Enregistrer quand même le signalement sans sanction
      const { rows } = await pool.query(
        `INSERT INTO signalements_retard
           (commande_id, structure_id, employe_id, photo_url, retard_minutes, note)
         VALUES ($1, $2, $3, $4, 0, $5)
         RETURNING id, commande_id, heure_signalement`,
        [commande_id, structure_id, employe_id ?? null, photo_url, note ?? null],
      );
      return {
        id: rows[0].id,
        commande_id,
        heure_signalement: rows[0].heure_signalement,
        retard_minutes: 0,
        niveau_sanction: null,
        reduction_pct: null,
        bon_emis: false,
        message: 'Signalement enregistré. Aucun retard détecté.',
      };
    }

    // 4. Trouver le niveau de sanction
    const { rows: paramRows } = await pool.query(
      `SELECT niveau, reduction_pct, emettre_bon
       FROM parametres_sanctions
       WHERE min_minutes <= $1
         AND (max_minutes IS NULL OR max_minutes >= $1)
       ORDER BY niveau ASC
       LIMIT 1`,
      [retardMinutes],
    );

    let niveauSanction: number | null = null;
    let reductionPct: number | null = null;
    let emettrebon = false;

    if (paramRows.length > 0) {
      niveauSanction = paramRows[0].niveau;
      reductionPct = Number(paramRows[0].reduction_pct);
      emettrebon = paramRows[0].emettre_bon;
    }

    // 5. Appliquer la réduction si applicable
    let bonEmis = false;
    if (reductionPct != null && reductionPct > 0) {
      await pool.query(
        `UPDATE commandes
         SET penalite = true,
             montant_final = ROUND(montant_total * (1 - $1::numeric / 100), 2),
             statut = CASE WHEN statut NOT IN ('livre') THEN 'en_retard' ELSE statut END,
             statut_updated_at = NOW()
         WHERE id = $2`,
        [reductionPct, commande_id],
      );

      // 6. Émettre un bon de réduction si configuré
      if (emettrebon) {
        const expireDate = new Date();
        expireDate.setDate(expireDate.getDate() + 30); // valable 30 jours
        await pool.query(
          `INSERT INTO bons_reduction (structure_id, valeur_pct, emis_le, expire_le)
           VALUES ($1, $2, NOW(), $3)`,
          [structure_id, reductionPct, expireDate.toISOString().split('T')[0]],
        );
        bonEmis = true;
      }
    }

    // 7. Enregistrer le signalement
    const { rows } = await pool.query(
      `INSERT INTO signalements_retard
         (commande_id, structure_id, employe_id, photo_url,
          retard_minutes, niveau_sanction, reduction_pct, bon_emis, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, commande_id, heure_signalement`,
      [
        commande_id, structure_id, employe_id ?? null, photo_url,
        retardMinutes, niveauSanction, reductionPct, bonEmis, note ?? null,
      ],
    );

    const message = niveauSanction
      ? `Retard de ${retardMinutes} min — Niveau ${niveauSanction} — Réduction ${reductionPct}%${bonEmis ? ' — Bon émis' : ''}`
      : `Retard de ${retardMinutes} min signalé. Aucune sanction applicable.`;

    return {
      id: rows[0].id,
      commande_id,
      heure_signalement: rows[0].heure_signalement,
      retard_minutes: retardMinutes,
      niveau_sanction: niveauSanction,
      reduction_pct: reductionPct,
      bon_emis: bonEmis,
      message,
    };
  },

  /**
   * Liste les signalements d'une structure.
   */
  async listByStructure(structureId: string): Promise<Record<string, unknown>[]> {
    const { rows } = await pool.query(
      `SELECT s.id, s.commande_id, s.photo_url, s.heure_signalement,
              s.retard_minutes, s.niveau_sanction, s.reduction_pct, s.bon_emis, s.note,
              c.creneau::text AS commande_creneau,
              c.date_commande::text AS commande_date,
              e.nom AS employe_nom
       FROM signalements_retard s
       JOIN commandes c ON c.id = s.commande_id
       LEFT JOIN employes e ON e.id = s.employe_id
       WHERE s.structure_id = $1
       ORDER BY s.heure_signalement DESC`,
      [structureId],
    );
    return rows;
  },

  /**
   * Liste tous les signalements (admin).
   */
  async listAll(limit = 100): Promise<Record<string, unknown>[]> {
    const { rows } = await pool.query(
      `SELECT s.id, s.commande_id, s.photo_url, s.heure_signalement,
              s.retard_minutes, s.niveau_sanction, s.reduction_pct, s.bon_emis, s.note,
              c.creneau::text AS commande_creneau,
              c.date_commande::text AS commande_date,
              st.nom AS structure_nom,
              e.nom AS employe_nom
       FROM signalements_retard s
       JOIN commandes c ON c.id = s.commande_id
       JOIN structures st ON st.id = s.structure_id
       LEFT JOIN employes e ON e.id = s.employe_id
       ORDER BY s.heure_signalement DESC
       LIMIT $1`,
      [limit],
    );
    return rows;
  },
};

export default SignalementService;
