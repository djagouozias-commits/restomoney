import pool from '../db/pool';
import { AppError } from '../utils/errors';

export interface PlanningEntry {
  jour_semaine: number; // 0=lundi, 6=dimanche
  position: number;     // 1-3
  plat_id: string;
}

export interface SurchargeEntry {
  date_jour: string; // YYYY-MM-DD
  position: number;  // 1-3
  plat_id: string;
}

export const PlanningService = {
  /**
   * Retourne le planning hebdomadaire complet (7 jours × 3 plats max)
   * avec les infos du plat jointé.
   */
  async getPlanning(): Promise<Record<string, unknown>[]> {
    const { rows } = await pool.query(
      `SELECT ph.id, ph.jour_semaine, ph.position, ph.plat_id,
              p.nom as plat_nom, p.description as plat_description,
              p.image_url as plat_image_url, p.prix as plat_prix, p.actif as plat_actif
       FROM planning_hebdomadaire ph
       JOIN plats p ON p.id = ph.plat_id
       ORDER BY ph.jour_semaine, ph.position`,
    );
    return rows;
  },

  /**
   * Remplace entièrement le planning hebdomadaire.
   */
  async savePlanning(entries: PlanningEntry[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM planning_hebdomadaire');
      for (const entry of entries) {
        await client.query(
          `INSERT INTO planning_hebdomadaire (jour_semaine, plat_id, position)
           VALUES ($1, $2, $3)
           ON CONFLICT (jour_semaine, position) DO UPDATE
             SET plat_id = EXCLUDED.plat_id`,
          [entry.jour_semaine, entry.plat_id, entry.position],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Retourne toutes les surcharges ponctuelles avec infos plat.
   */
  async getSurcharges(): Promise<Record<string, unknown>[]> {
    const { rows } = await pool.query(
      `SELECT sj.id, sj.date_jour, sj.position, sj.plat_id,
              p.nom as plat_nom, p.image_url as plat_image_url, p.prix as plat_prix
       FROM surcharges_jour sj
       JOIN plats p ON p.id = sj.plat_id
       ORDER BY sj.date_jour DESC, sj.position`,
    );
    return rows;
  },

  /**
   * Crée une surcharge ponctuelle pour une date donnée.
   */
  async createSurcharge(data: SurchargeEntry): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      `INSERT INTO surcharges_jour (date_jour, plat_id, position)
       VALUES ($1, $2, $3)
       ON CONFLICT (date_jour, position) DO UPDATE
         SET plat_id = EXCLUDED.plat_id
       RETURNING id, date_jour, plat_id, position`,
      [data.date_jour, data.plat_id, data.position],
    );
    return rows[0];
  },

  /**
   * Supprime une surcharge ponctuelle par son id.
   */
  async deleteSurcharge(id: string): Promise<void> {
    const { rows } = await pool.query(
      'DELETE FROM surcharges_jour WHERE id = $1 RETURNING id',
      [id],
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Surcharge introuvable', 404);
  },

  /**
   * Résout les 3 plats du jour pour une date donnée.
   * Priorité : surcharge ponctuelle > planning hebdomadaire.
   * Retourne un tableau de 0 à 3 entrées avec les infos du plat.
   */
  async resolvePlatsDuJour(date: Date): Promise<Record<string, unknown>[]> {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    // 1. Chercher une surcharge ponctuelle
    const { rows: surcharges } = await pool.query(
      `SELECT sj.position, sj.plat_id,
              p.id, p.nom, p.description, p.image_url, p.prix, p.actif
       FROM surcharges_jour sj
       JOIN plats p ON p.id = sj.plat_id
       WHERE sj.date_jour = $1
       ORDER BY sj.position`,
      [dateStr],
    );

    if (surcharges.length > 0) return surcharges;

    // 2. Fallback vers le planning hebdomadaire
    // PostgreSQL: EXTRACT(DOW ...) → 0=dimanche…6=samedi
    // Notre convention: 0=lundi…6=dimanche
    // On convertit: (DOW + 6) % 7
    const { rows: planning } = await pool.query(
      `SELECT ph.position, ph.plat_id,
              p.id, p.nom, p.description, p.image_url, p.prix, p.actif
       FROM planning_hebdomadaire ph
       JOIN plats p ON p.id = ph.plat_id
       WHERE ph.jour_semaine = ((EXTRACT(DOW FROM $1::date)::int + 6) % 7)
       ORDER BY ph.position`,
      [dateStr],
    );

    return planning;
  },
};

export default PlanningService;
