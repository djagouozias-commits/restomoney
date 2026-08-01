import pool from '../db/pool';

export interface CommandeEnRetard {
  id: string;
  structure_id: string;
  creneau: string;
  date_commande: string;
  montant_total: number;
}

export const RetardService = {
  /**
   * Détecte les commandes en retard : pour chaque créneau dépassé de > 10 min
   * aujourd'hui, passe le statut à 'en_retard' si pas encore 'livre' ou 'en_retard'.
   *
   * Retourne la liste des commandes qui viennent d'être marquées en retard
   * (pour diffusion SSE).
   *
   * Requirements: 9.1
   */
  async detecterRetards(): Promise<CommandeEnRetard[]> {
    const { rows } = await pool.query(
      `UPDATE commandes
       SET statut = 'en_retard', statut_updated_at = NOW()
       WHERE date_commande = CURRENT_DATE
         AND statut NOT IN ('livre', 'en_retard')
         AND (NOW()::time > creneau + INTERVAL '10 minutes')
       RETURNING id, structure_id, creneau::text, date_commande::text, montant_total`,
    );
    return rows as CommandeEnRetard[];
  },
};

export default RetardService;
