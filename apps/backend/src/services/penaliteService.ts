import pool from '../db/pool';
import { AppError } from '../utils/errors';

export const PenaliteService = {
  /**
   * Applique une pénalité de 50 % sur le montant total de la commande.
   * Calcule montant_final = montant_total * 0.5, active le flag penalite.
   *
   * Requirements: 9.3, 9.4
   */
  async appliquerPenalite(commandeId: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      `UPDATE commandes
       SET penalite = true,
           montant_final = ROUND(montant_total * 0.5, 2),
           statut_updated_at = NOW()
       WHERE id = $1
       RETURNING id, structure_id, creneau, date_commande, statut,
                 penalite, montant_total, montant_final, statut_updated_at`,
      [commandeId],
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Commande introuvable', 404);
    return rows[0];
  },
};

export default PenaliteService;
