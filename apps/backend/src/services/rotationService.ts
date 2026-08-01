import pool from '../db/pool';

export const RotationService = {
  /**
   * Exécute la rotation automatique des plats du jour pour la date donnée.
   * Idempotent : si déjà exécuté avec succès pour cette date, ne fait rien.
   *
   * Algorithme :
   * 1. Vérifie si rotation_logs contient déjà un succès pour cette date
   * 2. Désactive les plats_du_jour de la veille
   * 3. Résout les plats (surcharge > hebdomadaire)
   * 4. Insère dans plats_du_jour (ON CONFLICT DO NOTHING)
   * 5. Journalise le résultat
   *
   * Requirements: 3.5, 4.2, 11.1, 11.2, 11.3, 11.4
   */
  async executerRotation(date: Date): Promise<{ success: boolean; message?: string }> {
    const dateStr = date.toISOString().split('T')[0];

    // 1. Idempotence : déjà exécuté ?
    const { rows: existing } = await pool.query(
      `SELECT id FROM rotation_logs WHERE date_jour = $1 AND statut = 'succes'`,
      [dateStr],
    );
    if (existing.length > 0) {
      return { success: true, message: 'Rotation déjà exécutée pour cette date (idempotence)' };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 2. Désactiver les plats_du_jour de la veille
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      await client.query(
        `UPDATE plats_du_jour SET actif = false WHERE date_jour = $1`,
        [yesterdayStr],
      );

      // 3. Résoudre les plats : surcharge ponctuelle en priorité
      const { rows: surcharges } = await client.query(
        `SELECT plat_id, position FROM surcharges_jour WHERE date_jour = $1 ORDER BY position`,
        [dateStr],
      );

      let platsToInsert: Array<{ plat_id: string; position: number }> = [];

      if (surcharges.length > 0) {
        platsToInsert = surcharges.map((s) => ({ plat_id: s.plat_id, position: s.position }));
      } else {
        // Fallback : planning hebdomadaire (0=lundi…6=dimanche → (DOW+6)%7)
        const { rows: planning } = await client.query(
          `SELECT plat_id, position
           FROM planning_hebdomadaire
           WHERE jour_semaine = ((EXTRACT(DOW FROM $1::date)::int + 6) % 7)
           ORDER BY position`,
          [dateStr],
        );
        platsToInsert = planning.map((p) => ({ plat_id: p.plat_id, position: p.position }));
      }

      // 4. Insérer dans plats_du_jour (ON CONFLICT DO NOTHING pour idempotence)
      for (const plat of platsToInsert) {
        await client.query(
          `INSERT INTO plats_du_jour (date_jour, plat_id, position, actif)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (date_jour, plat_id) DO NOTHING`,
          [dateStr, plat.plat_id, plat.position],
        );
      }

      await client.query('COMMIT');

      // 5. Journaliser le succès
      await pool.query(
        `INSERT INTO rotation_logs (date_jour, statut, message)
         VALUES ($1, 'succes', $2)
         ON CONFLICT (date_jour) DO UPDATE SET statut = 'succes', message = $2, executed_at = NOW()`,
        [dateStr, `Rotation exécutée : ${platsToInsert.length} plat(s) activés`],
      );

      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK');

      const message = err instanceof Error ? err.message : String(err);

      // Journaliser l'échec
      await pool.query(
        `INSERT INTO rotation_logs (date_jour, statut, message)
         VALUES ($1, 'echec', $2)
         ON CONFLICT (date_jour) DO UPDATE SET statut = 'echec', message = $2, executed_at = NOW()`,
        [dateStr, message],
      ).catch(() => {}); // Ne pas masquer l'erreur principale

      throw err;
    } finally {
      client.release();
    }
  },
};

export default RotationService;
