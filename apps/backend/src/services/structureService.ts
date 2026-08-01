import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { AppError } from '../utils/errors';
import WalletService from './walletService';

function generateLogin(nom: string): string {
  const slug = nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);
  // 4-char alphanumeric suffix (a-z0-9)
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${slug}-${suffix}`;
}

// Mots simples pour générer des mots de passe mémorisables
const MOTS = [
  'Caniche', 'Luciole', 'Manguier', 'Savane', 'Baobab', 'Pirogue',
  'Kora', 'Teranga', 'Safran', 'Diorama', 'Falaise', 'Cobalt',
  'Niebe', 'Thiof', 'Dakar', 'Caiman', 'Ibis', 'Tamarin',
];

function generatePassword(): string {
  const mot = MOTS[Math.floor(Math.random() * MOTS.length)];
  const num = Math.floor(10 + Math.random() * 90); // 10-99
  return `${mot}${num}`;
}

async function ensureUniqueLogin(nom: string): Promise<string> {
  let login = generateLogin(nom);
  let attempts = 0;
  while (attempts < 10) {
    const { rows } = await pool.query('SELECT id FROM structures WHERE login = $1', [login]);
    if (rows.length === 0) return login;
    login = generateLogin(nom);
    attempts++;
  }
  // Fallback garanti unique
  return `struct-${uuidv4().slice(0, 8)}`;
}

export const StructureService = {
  async create(data: {
    nom: string;
    domaine?: string;
    telephone?: string;
    latitude: number;
    longitude: number;
  }): Promise<{ structure: Record<string, unknown>; plainPassword: string }> {
    const login = await ensureUniqueLogin(data.nom);
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    // Ouvrir une transaction pour créer structure + wallet atomiquement
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO structures (nom, domaine, telephone, latitude, longitude, login, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, nom, domaine, telephone, latitude, longitude, login, actif, created_at`,
        [data.nom, data.domaine || null, data.telephone || null, data.latitude, data.longitude, login, passwordHash]
      );
      const structure = rows[0];

      // Créer automatiquement le wallet avec solde 0 (Req 1.1)
      await WalletService.createWalletForStructure(structure.id, client);

      await client.query('COMMIT');
      return { structure, plainPassword };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async list(): Promise<Record<string, unknown>[]> {
    const { rows } = await pool.query(
      'SELECT id, nom, domaine, telephone, latitude, longitude, login, actif, created_at FROM structures ORDER BY created_at DESC'
    );
    return rows;
  },

  async getById(id: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      'SELECT id, nom, domaine, telephone, latitude, longitude, login, actif, created_at FROM structures WHERE id = $1',
      [id]
    );
    if (rows.length === 0) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Structure introuvable', 404);
    }
    return rows[0];
  },

  async update(id: string, data: {
    nom?: string;
    domaine?: string;
    telephone?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<Record<string, unknown>> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.nom !== undefined) { fields.push(`nom = $${idx++}`); values.push(data.nom); }
    if (data.domaine !== undefined) { fields.push(`domaine = $${idx++}`); values.push(data.domaine); }
    if (data.telephone !== undefined) { fields.push(`telephone = $${idx++}`); values.push(data.telephone); }
    if (data.latitude !== undefined) { fields.push(`latitude = $${idx++}`); values.push(data.latitude); }
    if (data.longitude !== undefined) { fields.push(`longitude = $${idx++}`); values.push(data.longitude); }

    if (fields.length === 0) return this.getById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE structures SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, nom, domaine, telephone, latitude, longitude, login, actif, created_at`,
      values
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Structure introuvable', 404);
    return rows[0];
  },

  async toggle(id: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      `UPDATE structures SET actif = NOT actif, updated_at = NOW()
       WHERE id = $1
       RETURNING id, nom, actif`,
      [id]
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Structure introuvable', 404);
    return rows[0];
  },

  async delete(id: string): Promise<void> {
    const { rowCount } = await pool.query('DELETE FROM structures WHERE id = $1', [id]);
    if (rowCount === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Structure introuvable', 404);
  },

  async resetPassword(id: string): Promise<{ login: string; plainPassword: string }> {
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const { rows } = await pool.query(
      `UPDATE structures SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, login`,
      [passwordHash, id]
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Structure introuvable', 404);

    // Invalider toutes les sessions existantes (req. 14.4)
    await pool.query('DELETE FROM sessions WHERE entity_id = $1 AND entity_type = $2', [id, 'structure']);

    return { login: rows[0].login, plainPassword };
  },
};

export default StructureService;
