import bcrypt from 'bcrypt';
import pool from '../db/pool';
import { AppError } from '../utils/errors';

// Mots de passe simples mémorisables
const MOTS = [
  'Mango', 'Cacao', 'Iroko', 'Benin', 'Calao', 'Lagune',
  'Okoume', 'Sakpata', 'Zango', 'Wologuede', 'Kotonu', 'Dassa',
  'Abomey', 'Parakou', 'Natitingou', 'Lokossa',
];

function generatePassword(): string {
  const mot = MOTS[Math.floor(Math.random() * MOTS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${mot}${num}`;
}

/**
 * Génère un slug à partir du nom de la structure.
 * "BOA International" → "boa"
 */
function slugStructure(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8) || 'emp';
}

/**
 * Trouve le prochain numéro disponible pour un slug donné.
 * Si "boa1", "boa2", "boa3" existent déjà → retourne "boa4"
 */
async function nextEmployeLogin(slug: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT login FROM employes WHERE login LIKE $1 ORDER BY login`,
    [`${slug}%`],
  );
  // Extraire les numéros existants
  const nums = rows
    .map((r: any) => parseInt(r.login.replace(slug, ''), 10))
    .filter((n: number) => !isNaN(n) && n > 0)
    .sort((a: number, b: number) => a - b);

  // Trouver le premier numéro libre
  let next = 1;
  for (const n of nums) {
    if (n === next) next++;
    else break;
  }
  return `${slug}${next}`;
}

export const EmployeService = {
  /**
   * Crée un employé pour une structure.
   * Login auto-généré : slug(structure) + numéro séquentiel.
   */
  async create(structureId: string, nom?: string): Promise<{
    employe: Record<string, unknown>;
    plainPassword: string;
  }> {
    // Récupérer le nom de la structure pour le slug
    const { rows: sRows } = await pool.query(
      'SELECT nom FROM structures WHERE id = $1',
      [structureId],
    );
    if (sRows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Structure introuvable', 404);

    const slug = slugStructure(sRows[0].nom);
    const login = await nextEmployeLogin(slug);
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const { rows } = await pool.query(
      `INSERT INTO employes (structure_id, login, nom, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, structure_id, login, nom, actif, created_at`,
      [structureId, login, nom || null, passwordHash],
    );

    return { employe: rows[0], plainPassword };
  },

  /**
   * Liste les employés d'une structure.
   */
  async listByStructure(structureId: string): Promise<Record<string, unknown>[]> {
    const { rows } = await pool.query(
      `SELECT id, structure_id, login, nom, actif, created_at
       FROM employes
       WHERE structure_id = $1
       ORDER BY login`,
      [structureId],
    );
    return rows;
  },

  /**
   * Réinitialise le mot de passe d'un employé.
   */
  async resetPassword(id: string): Promise<{ login: string; plainPassword: string }> {
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const { rows } = await pool.query(
      `UPDATE employes SET password_hash = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING login`,
      [passwordHash, id],
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Employe introuvable', 404);

    // Invalider les sessions de l'employé
    await pool.query(
      `DELETE FROM sessions WHERE entity_id = $1 AND entity_type = 'employe'`,
      [id],
    );

    return { login: rows[0].login, plainPassword };
  },

  /**
   * Supprime un employé et invalide ses sessions.
   */
  async delete(id: string): Promise<void> {
    await pool.query('DELETE FROM sessions WHERE entity_id = $1', [id]);
    const { rowCount } = await pool.query('DELETE FROM employes WHERE id = $1', [id]);
    if (rowCount === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Employe introuvable', 404);
  },

  /**
   * Active ou désactive un employé.
   */
  async toggle(id: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      `UPDATE employes SET actif = NOT actif, updated_at = NOW()
       WHERE id = $1
       RETURNING id, login, nom, actif`,
      [id],
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Employe introuvable', 404);
    return rows[0];
  },

  /**
   * Authentifie un employé par login + password.
   * Retourne l'employé et sa structure.
   */
  async authenticate(login: string, password: string): Promise<{
    employe: Record<string, unknown>;
    structureId: string;
  }> {
    const { rows } = await pool.query(
      `SELECT e.id, e.structure_id, e.login, e.nom, e.password_hash, e.actif,
              s.actif as structure_actif
       FROM employes e
       JOIN structures s ON s.id = e.structure_id
       WHERE e.login = $1`,
      [login],
    );

    if (rows.length === 0 || !rows[0].actif || !rows[0].structure_actif) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Identifiants invalides', 401);
    }

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Identifiants invalides', 401);
    }

    return {
      employe: {
        id: rows[0].id,
        login: rows[0].login,
        nom: rows[0].nom,
        structureId: rows[0].structure_id,
      },
      structureId: rows[0].structure_id,
    };
  },
};

export default EmployeService;
