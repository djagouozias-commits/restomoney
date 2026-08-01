import pool from '../db/pool';
import { AppError } from '../utils/errors';

export interface OptionInput {
  nom: string;
  position: number;
}

export interface ComposantInput {
  nom: string;
  a_choix: boolean;
  position: number;
  options?: OptionInput[];
}

export interface MenuInput {
  nom: string;
  description?: string;
  image_url?: string;
  prix: number;
  composants?: ComposantInput[];
}

export const MenuService = {
  async list(): Promise<Record<string, unknown>[]> {
    const { rows: menus } = await pool.query(
      `SELECT id, nom, description, image_url, prix, actif, created_at
       FROM menus_complets
       ORDER BY created_at DESC`,
    );

    if (menus.length === 0) return [];

    const menuIds = menus.map((m) => m.id);
    const { rows: composants } = await pool.query(
      `SELECT c.id, c.menu_complet_id, c.nom, c.a_choix, c.position,
              o.id as opt_id, o.nom as opt_nom, o.position as opt_position
       FROM composants c
       LEFT JOIN options o ON o.composant_id = c.id
       WHERE c.menu_complet_id = ANY($1)
       ORDER BY c.menu_complet_id, c.position, o.position`,
      [menuIds],
    );

    // Assemble the nested structure
    const composantMap = new Map<string, Map<string, Record<string, unknown>>>();
    for (const row of composants) {
      if (!composantMap.has(row.menu_complet_id)) {
        composantMap.set(row.menu_complet_id, new Map());
      }
      const cMap = composantMap.get(row.menu_complet_id)!;
      if (!cMap.has(row.id)) {
        cMap.set(row.id, {
          id: row.id,
          nom: row.nom,
          a_choix: row.a_choix,
          position: row.position,
          options: [],
        });
      }
      if (row.opt_id) {
        (cMap.get(row.id)!.options as unknown[]).push({
          id: row.opt_id,
          nom: row.opt_nom,
          position: row.opt_position,
        });
      }
    }

    return menus.map((m) => ({
      ...m,
      composants: composantMap.has(m.id)
        ? Array.from(composantMap.get(m.id)!.values())
        : [],
    }));
  },

  async getWithComposants(id: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      `SELECT id, nom, description, image_url, prix, actif, created_at
       FROM menus_complets WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Menu introuvable', 404);

    const { rows: composants } = await pool.query(
      `SELECT c.id, c.nom, c.a_choix, c.position,
              o.id as opt_id, o.nom as opt_nom, o.position as opt_position
       FROM composants c
       LEFT JOIN options o ON o.composant_id = c.id
       WHERE c.menu_complet_id = $1
       ORDER BY c.position, o.position`,
      [id],
    );

    const cMap = new Map<string, Record<string, unknown>>();
    for (const row of composants) {
      if (!cMap.has(row.id)) {
        cMap.set(row.id, {
          id: row.id,
          nom: row.nom,
          a_choix: row.a_choix,
          position: row.position,
          options: [],
        });
      }
      if (row.opt_id) {
        (cMap.get(row.id)!.options as unknown[]).push({
          id: row.opt_id,
          nom: row.opt_nom,
          position: row.opt_position,
        });
      }
    }

    return { ...rows[0], composants: Array.from(cMap.values()) };
  },

  async create(data: MenuInput): Promise<Record<string, unknown>> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO menus_complets (nom, description, image_url, prix)
         VALUES ($1, $2, $3, $4)
         RETURNING id, nom, description, image_url, prix, actif, created_at`,
        [data.nom, data.description || null, data.image_url || null, data.prix],
      );
      const menu = rows[0];

      const composants: Record<string, unknown>[] = [];
      for (const comp of data.composants || []) {
        const { rows: cRows } = await client.query(
          `INSERT INTO composants (menu_complet_id, nom, a_choix, position)
           VALUES ($1, $2, $3, $4)
           RETURNING id, nom, a_choix, position`,
          [menu.id, comp.nom, comp.a_choix, comp.position],
        );
        const composant = { ...cRows[0], options: [] as Record<string, unknown>[] };

        for (const opt of comp.options || []) {
          const { rows: oRows } = await client.query(
            `INSERT INTO options (composant_id, nom, position)
             VALUES ($1, $2, $3)
             RETURNING id, nom, position`,
            [cRows[0].id, opt.nom, opt.position],
          );
          composant.options.push(oRows[0]);
        }
        composants.push(composant);
      }

      await client.query('COMMIT');
      return { ...menu, composants };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update(id: string, data: Partial<MenuInput>): Promise<Record<string, unknown>> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      if (data.nom !== undefined) { fields.push(`nom = $${idx++}`); values.push(data.nom); }
      if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
      if (data.image_url !== undefined) { fields.push(`image_url = $${idx++}`); values.push(data.image_url); }
      if (data.prix !== undefined) { fields.push(`prix = $${idx++}`); values.push(data.prix); }

      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`);
        values.push(id);
        const { rows } = await client.query(
          `UPDATE menus_complets SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id`,
          values,
        );
        if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Menu introuvable', 404);
      }

      // Replace composants if provided
      if (data.composants !== undefined) {
        await client.query('DELETE FROM composants WHERE menu_complet_id = $1', [id]);
        for (const comp of data.composants) {
          const { rows: cRows } = await client.query(
            `INSERT INTO composants (menu_complet_id, nom, a_choix, position) VALUES ($1, $2, $3, $4) RETURNING id`,
            [id, comp.nom, comp.a_choix, comp.position],
          );
          for (const opt of comp.options || []) {
            await client.query(
              `INSERT INTO options (composant_id, nom, position) VALUES ($1, $2, $3)`,
              [cRows[0].id, opt.nom, opt.position],
            );
          }
        }
      }

      await client.query('COMMIT');
      return this.getWithComposants(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async toggle(id: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      `UPDATE menus_complets SET actif = NOT actif, updated_at = NOW()
       WHERE id = $1 RETURNING id, nom, actif`,
      [id],
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Menu introuvable', 404);
    return rows[0];
  },

  async delete(id: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT id FROM menus_complets WHERE id = $1', [id]);
      if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Menu introuvable', 404);
      // Supprimer les options, composants, puis le menu
      await client.query(
        `DELETE FROM options WHERE composant_id IN (SELECT id FROM composants WHERE menu_complet_id = $1)`,
        [id],
      );
      await client.query('DELETE FROM composants WHERE menu_complet_id = $1', [id]);
      await client.query('DELETE FROM menus_complets WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err instanceof AppError) throw err;
      // Contrainte FK : menu utilisé dans des commandes
      if (err?.code === '23503') {
        throw new AppError(
          'MENU_IN_USE',
          'Ce menu est utilisé dans des commandes existantes et ne peut pas être supprimé. Désactivez-le à la place.',
          409,
        );
      }
      throw err;
    } finally {
      client.release();
    }
  },
};

export default MenuService;
