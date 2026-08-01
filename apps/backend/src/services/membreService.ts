import pool from '../db/pool';
import { AppError } from '../utils/errors';

export interface MembreInput {
  nom: string;
  telephone: string;
  whatsapp?: string | null;
  poste?: string | null;
}

export const MembreService = {
  /**
   * Liste les membres d'une structure.
   */
  async listByStructure(structureId: string): Promise<Record<string, unknown>[]> {
    const { rows } = await pool.query(
      `SELECT id, structure_id, nom, telephone, whatsapp, poste, actif, created_at
       FROM membres
       WHERE structure_id = $1
       ORDER BY nom`,
      [structureId],
    );
    return rows;
  },

  /**
   * Crée un membre pour une structure.
   * WhatsApp = téléphone par défaut si non fourni.
   */
  async create(structureId: string, input: MembreInput): Promise<Record<string, unknown>> {
    const { nom, telephone, whatsapp, poste } = input;
    const { rows } = await pool.query(
      `INSERT INTO membres (structure_id, nom, telephone, whatsapp, poste)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, structure_id, nom, telephone, whatsapp, poste, actif, created_at`,
      [
        structureId,
        nom,
        telephone,
        whatsapp ?? telephone, // WhatsApp = téléphone par défaut
        poste ?? null,
      ],
    );
    return rows[0];
  },

  /**
   * Met à jour un membre.
   */
  async update(id: string, structureId: string, input: Partial<MembreInput>): Promise<Record<string, unknown>> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    if (input.nom !== undefined) { setClauses.push(`nom = $${idx++}`); values.push(input.nom); }
    if (input.telephone !== undefined) { setClauses.push(`telephone = $${idx++}`); values.push(input.telephone); }
    if (input.whatsapp !== undefined) { setClauses.push(`whatsapp = $${idx++}`); values.push(input.whatsapp); }
    if (input.poste !== undefined) { setClauses.push(`poste = $${idx++}`); values.push(input.poste); }

    if (setClauses.length === 1) {
      const { rows } = await pool.query(
        'SELECT id, nom, telephone, whatsapp, poste, actif FROM membres WHERE id = $1 AND structure_id = $2',
        [id, structureId],
      );
      if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Membre introuvable', 404);
      return rows[0];
    }

    values.push(id, structureId);
    const { rows } = await pool.query(
      `UPDATE membres SET ${setClauses.join(', ')}
       WHERE id = $${idx++} AND structure_id = $${idx++}
       RETURNING id, nom, telephone, whatsapp, poste, actif`,
      values,
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Membre introuvable', 404);
    return rows[0];
  },

  /**
   * Supprime un membre.
   */
  async delete(id: string, structureId: string): Promise<void> {
    const { rowCount } = await pool.query(
      'DELETE FROM membres WHERE id = $1 AND structure_id = $2',
      [id, structureId],
    );
    if (rowCount === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Membre introuvable', 404);
  },

  /**
   * Toggle actif/inactif.
   */
  async toggle(id: string, structureId: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      `UPDATE membres SET actif = NOT actif, updated_at = NOW()
       WHERE id = $1 AND structure_id = $2
       RETURNING id, nom, telephone, actif`,
      [id, structureId],
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Membre introuvable', 404);
    return rows[0];
  },
};

export default MembreService;
