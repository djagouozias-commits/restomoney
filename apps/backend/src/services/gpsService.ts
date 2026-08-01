import pool from '../db/pool';

export interface GpsPosition {
  livreur_id: string;
  mission_id?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface LastPosition extends GpsPosition {
  livreur_nom: string;
  recorded_at: Date;
}

export const GpsService = {
  /**
   * Persiste une position GPS reçue via Socket.IO.
   * Conserve les N dernières positions par livreur (prune > 500 points).
   */
  async savePosition(pos: GpsPosition): Promise<void> {
    await pool.query(
      `INSERT INTO livreur_positions
         (livreur_id, mission_id, latitude, longitude, accuracy, heading, speed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        pos.livreur_id,
        pos.mission_id ?? null,
        pos.latitude,
        pos.longitude,
        pos.accuracy ?? null,
        pos.heading ?? null,
        pos.speed ?? null,
      ],
    );

    // Prune : garder seulement les 500 dernières positions par livreur
    await pool.query(
      `DELETE FROM livreur_positions
       WHERE livreur_id = $1
         AND id NOT IN (
           SELECT id FROM livreur_positions
           WHERE livreur_id = $1
           ORDER BY recorded_at DESC
           LIMIT 500
         )`,
      [pos.livreur_id],
    );
  },

  /**
   * Retourne la dernière position connue de tous les livreurs actifs.
   * Utilisé pour initialiser la carte côté admin.
   */
  async getLastPositions(): Promise<LastPosition[]> {
    const { rows } = await pool.query(
      `SELECT livreur_id, livreur_nom, mission_id,
              latitude, longitude, accuracy, heading, speed, recorded_at
       FROM last_livreur_positions`,
    );
    return rows as LastPosition[];
  },

  /**
   * Retourne l'historique des positions d'une mission (pour le tracé de route).
   */
  async getMissionTrack(missionId: string): Promise<GpsPosition[]> {
    const { rows } = await pool.query(
      `SELECT livreur_id, mission_id, latitude, longitude,
              accuracy, heading, speed, recorded_at
       FROM livreur_positions
       WHERE mission_id = $1
       ORDER BY recorded_at ASC`,
      [missionId],
    );
    return rows as GpsPosition[];
  },
};

export default GpsService;
