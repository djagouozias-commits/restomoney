import pool from '../db/pool';
import { AppError } from '../utils/errors';

export interface PlatVariante {
  id: string;
  plat_id: string;
  libelle: string;
  prix: number;
  position: number;
  created_at: string;
}

export const PlatService = {
  // ─── Variante methods ────────────────────────────────────────────────────

  // Task 2.1 — list variantes for a plat, ordered by position ASC
  async listVariantes(platId: string): Promise<PlatVariante[]> {
    const { rows } = await pool.query<PlatVariante>(
      `SELECT id::text, plat_id::text, libelle, prix::float, position, created_at
       FROM plat_variantes
       WHERE plat_id = $1
       ORDER BY position ASC`,
      [platId]
    );
    return rows;
  },

  // Task 2.2 — create a variante, auto-computing the next position
  async createVariante(platId: string, data: { libelle: string; prix: number }): Promise<PlatVariante> {
    // Compute next position
    const posResult = await pool.query<{ next_pos: number }>(
      `SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
       FROM plat_variantes
       WHERE plat_id = $1`,
      [platId]
    );
    const nextPos = posResult.rows[0].next_pos;

    const { rows } = await pool.query<PlatVariante>(
      `INSERT INTO plat_variantes (plat_id, libelle, prix, position)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text, plat_id::text, libelle, prix::float, position, created_at`,
      [platId, data.libelle, data.prix, nextPos]
    );
    return rows[0];
  },

  // Task 2.3 — update a variante; sync plats.prix if position = 1
  async updateVariante(
    platId: string,
    varianteId: string,
    data: Partial<{ libelle: string; prix: number }>
  ): Promise<PlatVariante> {
    // Check ownership
    const check = await pool.query(
      `SELECT id, position FROM plat_variantes WHERE id = $1 AND plat_id = $2`,
      [varianteId, platId]
    );
    if (check.rows.length === 0) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Variante introuvable', 404);
    }
    const currentPosition: number = check.rows[0].position;

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (data.libelle !== undefined) { fields.push(`libelle = $${idx++}`); values.push(data.libelle); }
    if (data.prix !== undefined) { fields.push(`prix = $${idx++}`); values.push(data.prix); }

    if (fields.length === 0) {
      // Nothing to update — return current state
      const { rows } = await pool.query<PlatVariante>(
        `SELECT id::text, plat_id::text, libelle, prix::float, position, created_at
         FROM plat_variantes WHERE id = $1`,
        [varianteId]
      );
      return rows[0];
    }

    values.push(varianteId);
    const { rows } = await pool.query<PlatVariante>(
      `UPDATE plat_variantes SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id::text, plat_id::text, libelle, prix::float, position, created_at`,
      values
    );
    const updated = rows[0];

    // Sync plats.prix when updating variante at position 1
    if (currentPosition === 1 && data.prix !== undefined) {
      await pool.query(
        `UPDATE plats SET prix = $1, updated_at = NOW() WHERE id = $2`,
        [data.prix, platId]
      );
    }

    return updated;
  },

  // Task 2.4 — delete a variante; reject if it is the last one
  async deleteVariante(platId: string, varianteId: string): Promise<void> {
    // Check ownership
    const check = await pool.query(
      `SELECT id FROM plat_variantes WHERE id = $1 AND plat_id = $2`,
      [varianteId, platId]
    );
    if (check.rows.length === 0) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Variante introuvable', 404);
    }

    // Count variantes for this plat
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM plat_variantes WHERE plat_id = $1`,
      [platId]
    );
    const count = parseInt(countResult.rows[0].count, 10);
    if (count <= 1) {
      throw new AppError(
        'LAST_VARIANTE_ERROR',
        'Impossible de supprimer la dernière variante',
        409
      );
    }

    await pool.query(`DELETE FROM plat_variantes WHERE id = $1`, [varianteId]);
  },

  // ─── Existing methods (modified) ─────────────────────────────────────────

  // Task 2.7 — create a plat + auto-insert a 'Standard' variante in a transaction
  async create(data: {
    nom: string;
    description?: string;
    prix: number;
    image_url?: string;
    avec_jetable?: boolean;
  }): Promise<Record<string, unknown>> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: platRows } = await client.query(
        `INSERT INTO plats (nom, description, prix, image_url, avec_jetable)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nom, description, prix, image_url, actif, avec_jetable, created_at`,
        [data.nom, data.description || null, data.prix, data.image_url || null, data.avec_jetable ?? false]
      );
      const plat = platRows[0];

      await client.query(
        `INSERT INTO plat_variantes (plat_id, libelle, prix, position)
         VALUES ($1, 'Standard', $2, 1)`,
        [plat.id, data.prix]
      );

      await client.query('COMMIT');

      return {
        ...plat,
        variantes: [{ libelle: 'Standard', prix: data.prix, position: 1 }],
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Task 2.5 — list all plats and attach variantes[] via a second query
  async list(): Promise<Record<string, unknown>[]> {
    const { rows: plats } = await pool.query(
      'SELECT id, nom, description, prix, image_url, actif, avec_jetable, created_at FROM plats ORDER BY created_at DESC'
    );

    if (plats.length === 0) return plats;

    const platIds = plats.map((p) => p.id);
    const { rows: variantes } = await pool.query<PlatVariante>(
      `SELECT id::text, plat_id::text, libelle, prix::float, position
       FROM plat_variantes
       WHERE plat_id = ANY($1)
       ORDER BY plat_id, position ASC`,
      [platIds]
    );

    // Group variantes by plat_id
    const variantesByPlat = new Map<string, PlatVariante[]>();
    for (const v of variantes) {
      const list = variantesByPlat.get(v.plat_id) ?? [];
      list.push(v);
      variantesByPlat.set(v.plat_id, list);
    }

    return plats.map((p) => ({
      ...p,
      variantes: variantesByPlat.get(String(p.id)) ?? [],
    }));
  },

  // Task 2.6 — getById with variantes[]
  async getById(id: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      'SELECT id, nom, description, prix, image_url, actif, avec_jetable, created_at FROM plats WHERE id = $1',
      [id]
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Plat introuvable', 404);

    const plat = rows[0];
    const { rows: variantes } = await pool.query<PlatVariante>(
      `SELECT id::text, plat_id::text, libelle, prix::float, position
       FROM plat_variantes
       WHERE plat_id = $1
       ORDER BY position ASC`,
      [id]
    );

    return { ...plat, variantes };
  },

  async update(
    id: string,
    data: {
      nom?: string;
      description?: string;
      prix?: number;
      image_url?: string;
      avec_jetable?: boolean;
    }
  ): Promise<Record<string, unknown>> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (data.nom !== undefined) { fields.push(`nom = $${idx++}`); values.push(data.nom); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
    if (data.prix !== undefined) { fields.push(`prix = $${idx++}`); values.push(data.prix); }
    if (data.image_url !== undefined) { fields.push(`image_url = $${idx++}`); values.push(data.image_url); }
    if (data.avec_jetable !== undefined) { fields.push(`avec_jetable = $${idx++}`); values.push(data.avec_jetable); }
    if (fields.length === 0) return this.getById(id);
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE plats SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, nom, description, prix, image_url, actif, avec_jetable, created_at`,
      values
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Plat introuvable', 404);
    return rows[0];
  },

  async toggle(id: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      `UPDATE plats SET actif = NOT actif, updated_at = NOW() WHERE id = $1 RETURNING id, nom, actif`,
      [id]
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Plat introuvable', 404);
    return rows[0];
  },

  async toggleJetable(id: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      `UPDATE plats SET avec_jetable = NOT avec_jetable, updated_at = NOW() WHERE id = $1 RETURNING id, nom, avec_jetable`,
      [id]
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Plat introuvable', 404);
    return rows[0];
  },

  async delete(id: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT id FROM plats WHERE id = $1', [id]);
      if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Plat introuvable', 404);
      await client.query('DELETE FROM plat_variantes WHERE plat_id = $1', [id]);
      await client.query('DELETE FROM plats WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err instanceof AppError) throw err;
      if (err?.code === '23503') {
        throw new AppError(
          'PLAT_IN_USE',
          'Ce plat est utilisé dans des commandes existantes et ne peut pas être supprimé. Désactivez-le à la place.',
          409,
        );
      }
      throw err;
    } finally {
      client.release();
    }
  },
};

export default PlatService;
