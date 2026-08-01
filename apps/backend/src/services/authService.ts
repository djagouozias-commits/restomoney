import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { AppError } from '../utils/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

interface TokenPayload {
  entityId: string;
  role: 'structure' | 'admin' | 'employe' | 'livreur';
  structureId?: string; // Pour les employés
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  entityId: string;
  role: 'structure' | 'admin' | 'employe' | 'livreur';
  structureId?: string;
}

export const AuthService = {
  async loginStructure(login: string, password: string): Promise<AuthTokens> {
    // Essayer d'abord un login employé individuel
    const { rows: empRows } = await pool.query(
      `SELECT e.id, e.structure_id, e.password_hash, e.actif, e.login as emp_login,
              s.actif as structure_actif
       FROM employes e
       JOIN structures s ON s.id = e.structure_id
       WHERE e.login = $1`,
      [login],
    );

    if (empRows.length > 0) {
      if (!empRows[0].actif || !empRows[0].structure_actif) {
        throw new AppError('AUTH_INVALID_CREDENTIALS', 'Identifiants invalides', 401);
      }
      const validEmp = await bcrypt.compare(password, empRows[0].password_hash);
      if (!validEmp) {
        throw new AppError('AUTH_INVALID_CREDENTIALS', 'Identifiants invalides', 401);
      }
      const tokens = await this.generateTokenPair(empRows[0].id, 'employe' as any, empRows[0].structure_id);
      return { ...tokens, entityId: empRows[0].id, structureId: empRows[0].structure_id };
    }

    // Fallback : login structure directe (rétrocompat)
    const { rows } = await pool.query(
      'SELECT id, password_hash, actif FROM structures WHERE login = $1',
      [login]
    );

    if (rows.length === 0 || !rows[0].actif) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Identifiants invalides', 401);
    }

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Identifiants invalides', 401);
    }

    return this.generateTokenPair(rows[0].id, 'structure');
  },

  async loginAdmin(email: string, password: string): Promise<AuthTokens> {
    const { rows } = await pool.query(
      'SELECT id, password_hash FROM admins WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Identifiants invalides', 401);
    }

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Identifiants invalides', 401);
    }

    return this.generateTokenPair(rows[0].id, 'admin');
  },

  async generateTokenPair(entityId: string, role: 'structure' | 'admin' | 'employe' | 'livreur', structureId?: string): Promise<AuthTokens> {
    const payload: TokenPayload = { entityId, role, ...(structureId ? { structureId } : {}) };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = uuidv4();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    let entityType: string;
    if (role === 'employe') {
      entityType = 'employe';
    } else if (role === 'livreur') {
      entityType = 'livreur';
    } else {
      entityType = role;
    }

    await pool.query(
      'INSERT INTO sessions (entity_id, entity_type, refresh_token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [entityId, entityType, refreshTokenHash, expiresAt]
    );

    return { accessToken, refreshToken, entityId, role, structureId };
  },

  async loginLivreur(login: string, password: string): Promise<AuthTokens> {
    const { rows } = await pool.query(
      'SELECT id, password_hash, actif FROM livreurs WHERE login = $1',
      [login]
    );

    if (rows.length === 0 || !rows[0].actif) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Identifiants invalides', 401);
    }

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Identifiants invalides', 401);
    }

    return this.generateTokenPair(rows[0].id, 'livreur');
  },

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const { rows } = await pool.query<{
      id: string;
      entity_id: string;
      entity_type: string;
      refresh_token_hash: string;
      expires_at: Date;
    }>(
      'SELECT id, entity_id, entity_type, refresh_token_hash, expires_at FROM sessions WHERE expires_at > NOW()',
      []
    );

    let session: typeof rows[0] | null = null;
    for (const row of rows) {
      const valid = await bcrypt.compare(refreshToken, row.refresh_token_hash);
      if (valid) {
        session = row;
        break;
      }
    }

    if (!session) {
      throw new AppError('AUTH_SESSION_EXPIRED', 'Session expirée', 401);
    }

    // Supprimer l'ancienne session
    await pool.query('DELETE FROM sessions WHERE id = $1', [session.id]);

    // Pour un employé, récupérer le structureId depuis la table employes
    if (session.entity_type === 'employe') {
      const { rows: empRows } = await pool.query<{ structure_id: string }>(
        'SELECT structure_id FROM employes WHERE id = $1',
        [session.entity_id],
      );
      const structureId = empRows[0]?.structure_id;
      return this.generateTokenPair(session.entity_id, 'employe', structureId);
    }

    return this.generateTokenPair(session.entity_id, session.entity_type as 'structure' | 'admin' | 'employe' | 'livreur');
  },

  async logout(entityId: string, entityType: string): Promise<void> {
    await pool.query(
      'DELETE FROM sessions WHERE entity_id = $1 AND entity_type = $2',
      [entityId, entityType]
    );
  },
};

export default AuthService;
