import pool from '../db/pool';
import { AppError } from '../utils/errors';

/**
 * Distance Haversine en km entre deux points GPS.
 */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Algorithme Nearest-Neighbor pour ordonner les structures depuis un point d'origine.
 */
function nearestNeighbor(
  origin: { lat: number; lon: number },
  points: Array<{ id: string; lat: number; lon: number }>,
): Array<{ id: string; lat: number; lon: number }> {
  const unvisited = [...points];
  const ordered: typeof points = [];
  let current = origin;

  while (unvisited.length > 0) {
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const dist = haversine(current.lat, current.lon, unvisited[i].lat, unvisited[i].lon);
      if (dist < minDist) { minDist = dist; nearest = i; }
    }
    ordered.push(unvisited[nearest]);
    current = unvisited[nearest];
    unvisited.splice(nearest, 1);
  }

  return ordered;
}

// Coordonnées du restaurant (point de départ) — Cotonou, Bénin par défaut
const RESTAURANT_LAT = parseFloat(process.env.RESTAURANT_LAT || '6.3654');
const RESTAURANT_LON = parseFloat(process.env.RESTAURANT_LON || '2.4183');

export const TourneeService = {
  /**
   * Crée une tournée pour un créneau/date, calcule l'ordre nearest-neighbor
   * depuis les coordonnées GPS des structures ayant commandé pour ce créneau.
   *
   * Requirements: 10.1, 10.2
   */
  async create(creneau: string, dateTournee: string): Promise<Record<string, unknown>> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Récupérer les structures qui ont une commande pour ce créneau/date
      const { rows: structures } = await client.query(
        `SELECT DISTINCT s.id, s.nom, s.latitude::float as lat, s.longitude::float as lon
         FROM commandes c
         JOIN structures s ON s.id = c.structure_id
         WHERE c.creneau = $1::time AND c.date_commande = $2::date
           AND c.statut NOT IN ('livre')`,
        [`${creneau}:00`, dateTournee],
      );

      // Calculer l'ordre optimal
      const ordered = nearestNeighbor(
        { lat: RESTAURANT_LAT, lon: RESTAURANT_LON },
        structures.map((s) => ({ id: s.id, lat: s.lat, lon: s.lon })),
      );

      // Créer la tournée
      const { rows: tourneeRows } = await client.query(
        `INSERT INTO tournees (creneau, date_tournee)
         VALUES ($1::time, $2::date)
         RETURNING id, creneau::text, date_tournee::text, statut, created_at`,
        [`${creneau}:00`, dateTournee],
      );
      const tournee = tourneeRows[0];

      // Insérer les étapes dans l'ordre
      for (let i = 0; i < ordered.length; i++) {
        await client.query(
          `INSERT INTO tournee_structures (tournee_id, structure_id, ordre)
           VALUES ($1, $2, $3)`,
          [tournee.id, ordered[i].id, i + 1],
        );
      }

      await client.query('COMMIT');
      return { ...tournee, etapes: ordered.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async list(filters: { date?: string; creneau?: string } = {}): Promise<Record<string, unknown>[]> {
    let query = `SELECT id, creneau::text, date_tournee::text, statut, created_at FROM tournees WHERE 1=1`;
    const params: unknown[] = [];
    let idx = 1;

    if (filters.date) { query += ` AND date_tournee = $${idx++}::date`; params.push(filters.date); }
    if (filters.creneau) { query += ` AND creneau = $${idx++}::time`; params.push(`${filters.creneau}:00`); }

    query += ' ORDER BY date_tournee DESC, creneau';
    const { rows } = await pool.query(query, params);
    return rows;
  },

  async getById(id: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      `SELECT id, creneau::text, date_tournee::text, statut, created_at FROM tournees WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Tournée introuvable', 404);

    const { rows: etapes } = await pool.query(
      `SELECT ts.id, ts.ordre, ts.livre, ts.livre_at,
              s.id as structure_id, s.nom as structure_nom,
              s.latitude::float as lat, s.longitude::float as lon, s.telephone
       FROM tournee_structures ts
       JOIN structures s ON s.id = ts.structure_id
       WHERE ts.tournee_id = $1
       ORDER BY ts.ordre`,
      [id],
    );

    return { ...rows[0], etapes };
  },

  /**
   * Réordonne manuellement les structures d'une tournée.
   * ordre : tableau de { structure_id, ordre }
   *
   * Requirements: 10.3
   */
  async reordonner(
    id: string,
    ordre: Array<{ structure_id: string; ordre: number }>,
  ): Promise<Record<string, unknown>> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const entry of ordre) {
        await client.query(
          `UPDATE tournee_structures SET ordre = $1 WHERE tournee_id = $2 AND structure_id = $3`,
          [entry.ordre, id, entry.structure_id],
        );
      }
      await client.query('COMMIT');
      return this.getById(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Marque la livraison effectuée pour une structure dans une tournée.
   *
   * Requirements: 10.4
   */
  async marquerLivraison(tourneeId: string, structureId: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      `UPDATE tournee_structures
       SET livre = true, livre_at = NOW()
       WHERE tournee_id = $1 AND structure_id = $2
       RETURNING id, ordre, livre, livre_at`,
      [tourneeId, structureId],
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Étape introuvable', 404);

    // Marquer les commandes de cette structure comme livrées
    await pool.query(
      `UPDATE commandes
       SET statut = 'livre', statut_updated_at = NOW()
       WHERE structure_id = $1
         AND date_commande = (SELECT date_tournee FROM tournees WHERE id = $2)
         AND creneau = (SELECT creneau FROM tournees WHERE id = $2)
         AND statut != 'livre'`,
      [structureId, tourneeId],
    );

    return rows[0];
  },
};

export default TourneeService;
