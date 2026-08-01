import bcrypt from 'bcrypt';
import pool from '../db/pool';
import { AppError } from '../utils/errors';

// ─── Mission interfaces ───────────────────────────────────────────────────────

export interface CreateMissionInput {
  livreur_id: string;
  date_mission: string; // YYYY-MM-DD
  circuit: string;
  commande_ids: string[];
}

export interface UpdateMissionInput {
  circuit?: string;
  date_mission?: string;
  commande_ids?: string[];
}

export interface CommandeInMission {
  commande_id: string;
  statut_livraison: string;
  structure_nom: string;
  structure_latitude: number;
  structure_longitude: number;
  creneau: string;
  montant_total: number;
}

export interface MissionWithCommandes {
  id: string;
  livreur_id: string;
  date_mission: string;
  circuit: string;
  statut_mission: string;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  commandes: CommandeInMission[];
  livrees: number;
  total: number;
}

// Mots de passe simples mémorisables (même lexique que employeService)
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

export interface CreateLivreurInput {
  login: string;
  password: string;
  nom: string;
  zone_habituelle: string;
}

export interface UpdateLivreurInput {
  nom?: string;
  zone_habituelle?: string;
  actif?: boolean;
}

export interface LivreurRecord {
  id: string;
  login: string;
  nom: string;
  zone_habituelle: string;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export const LivreurService = {
  /**
   * Crée un nouveau livreur.
   * Vérifie l'unicité du login, hache le mot de passe avec bcrypt (10 rounds),
   * insère dans `livreurs` et retourne l'enregistrement sans `password_hash`.
   */
  async createLivreur(input: CreateLivreurInput): Promise<LivreurRecord> {
    const { login, password, nom, zone_habituelle } = input;

    // Vérifier l'unicité du login
    const { rows: existing } = await pool.query(
      'SELECT id FROM livreurs WHERE login = $1',
      [login],
    );
    if (existing.length > 0) {
      throw new AppError('LIVREUR_LOGIN_DUPLICATE', 'Ce login est déjà utilisé', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO livreurs (login, nom, zone_habituelle, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, login, nom, zone_habituelle, actif, created_at, updated_at`,
      [login, nom, zone_habituelle, passwordHash],
    );

    return rows[0] as LivreurRecord;
  },

  /**
   * Retourne tous les livreurs triés par nom, sans `password_hash`.
   */
  async listLivreurs(): Promise<LivreurRecord[]> {
    const { rows } = await pool.query(
      `SELECT id, login, nom, zone_habituelle, actif, created_at, updated_at
       FROM livreurs
       ORDER BY nom`,
    );
    return rows as LivreurRecord[];
  },

  /**
   * Mise à jour partielle d'un livreur (PATCH).
   * Seuls les champs fournis (nom, zone_habituelle, actif) sont mis à jour.
   * Les champs non fournis restent inchangés.
   * Retourne l'enregistrement mis à jour.
   */
  async updateLivreur(id: string, input: UpdateLivreurInput): Promise<LivreurRecord> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.nom !== undefined) {
      setClauses.push(`nom = $${paramIndex++}`);
      values.push(input.nom);
    }
    if (input.zone_habituelle !== undefined) {
      setClauses.push(`zone_habituelle = $${paramIndex++}`);
      values.push(input.zone_habituelle);
    }
    if (input.actif !== undefined) {
      setClauses.push(`actif = $${paramIndex++}`);
      values.push(input.actif);
    }

    // Aucun champ fourni — retourner l'enregistrement actuel
    if (setClauses.length === 0) {
      const { rows } = await pool.query(
        `SELECT id, login, nom, zone_habituelle, actif, created_at, updated_at
         FROM livreurs WHERE id = $1`,
        [id],
      );
      if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Livreur introuvable', 404);
      return rows[0] as LivreurRecord;
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE livreurs
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, login, nom, zone_habituelle, actif, created_at, updated_at`,
      values,
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Livreur introuvable', 404);
    return rows[0] as LivreurRecord;
  },

  /**
   * Réinitialise le mot de passe d'un livreur.
   * Génère un mot de passe mémorisable (mot du lexique + 2 chiffres),
   * hache avec bcrypt 10 rounds, invalide les sessions existantes.
   * Retourne { login, plainPassword }.
   */
  async resetPassword(id: string): Promise<{ login: string; plainPassword: string }> {
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const { rows } = await pool.query(
      `UPDATE livreurs SET password_hash = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING login`,
      [passwordHash, id],
    );
    if (rows.length === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Livreur introuvable', 404);

    // Invalider les sessions existantes du livreur
    await pool.query(
      `DELETE FROM sessions WHERE entity_id = $1 AND entity_type = 'livreur'`,
      [id],
    );

    return { login: rows[0].login, plainPassword };
  },

  /**
   * Désactive un livreur (actif = false) et supprime ses sessions actives.
   */
  async deactivateLivreur(id: string): Promise<void> {
    const { rowCount } = await pool.query(
      `UPDATE livreurs SET actif = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    if (rowCount === 0) throw new AppError('RESOURCE_NOT_FOUND', 'Livreur introuvable', 404);

    await pool.query(
      `DELETE FROM sessions WHERE entity_id = $1 AND entity_type = 'livreur'`,
      [id],
    );
  },

  // ─── Mission helpers ─────────────────────────────────────────────────────

  /**
   * Construit un tableau MissionWithCommandes à partir des lignes brutes d'une
   * requête JOIN missions → mission_commandes → commandes → structures.
   * Chaque ligne doit exposer les colonnes :
   *   mission_id, livreur_id, date_mission, circuit, statut_mission,
   *   started_at, completed_at, created_at, updated_at,
   *   commande_id, statut_livraison, structure_nom, structure_latitude,
   *   structure_longitude, creneau, montant_total
   */
  _buildMissions(rows: Record<string, unknown>[]): MissionWithCommandes[] {
    const map = new Map<string, MissionWithCommandes>();

    for (const r of rows) {
      const missionId = r.mission_id as string;
      if (!map.has(missionId)) {
        map.set(missionId, {
          id: missionId,
          livreur_id: r.livreur_id as string,
          date_mission: r.date_mission as string,
          circuit: r.circuit as string,
          statut_mission: r.statut_mission as string,
          started_at: (r.started_at as Date) ?? null,
          completed_at: (r.completed_at as Date) ?? null,
          created_at: r.created_at as Date,
          updated_at: r.updated_at as Date,
          commandes: [],
          livrees: 0,
          total: 0,
        });
      }
      const mission = map.get(missionId)!;

      if (r.commande_id) {
        const statutLivraison = r.statut_livraison as string;
        mission.commandes.push({
          commande_id: r.commande_id as string,
          statut_livraison: statutLivraison,
          structure_nom: r.structure_nom as string,
          structure_latitude: Number(r.structure_latitude),
          structure_longitude: Number(r.structure_longitude),
          creneau: r.creneau as string,
          montant_total: Number(r.montant_total),
        });
        mission.total += 1;
        if (statutLivraison === 'livre') mission.livrees += 1;
      }
    }

    return Array.from(map.values());
  },

  // ─── 4.1 createMission ───────────────────────────────────────────────────

  /**
   * Crée une mission dans une transaction :
   * - vérifie que chaque commande_id existe dans `commandes`
   * - insère dans `missions` avec statut_mission = 'en_attente'
   * - insère toutes les lignes dans `mission_commandes` avec statut_livraison = 'a_livrer'
   */
  async createMission(input: CreateMissionInput): Promise<MissionWithCommandes> {
    const { livreur_id, date_mission, circuit, commande_ids } = input;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Vérifier l'existence de chaque commande
      for (const cid of commande_ids) {
        const { rows } = await client.query(
          'SELECT id FROM commandes WHERE id = $1',
          [cid],
        );
        if (rows.length === 0) {
          throw new AppError(
            'MISSION_COMMANDE_NOT_FOUND',
            `Commande introuvable : ${cid}`,
            404,
          );
        }
      }

      // Insérer la mission
      const { rows: missionRows } = await client.query(
        `INSERT INTO missions (livreur_id, date_mission, circuit, statut_mission)
         VALUES ($1, $2, $3, 'en_attente')
         RETURNING id`,
        [livreur_id, date_mission, circuit],
      );
      const missionId: string = missionRows[0].id;

      // Insérer les mission_commandes
      for (const cid of commande_ids) {
        await client.query(
          `INSERT INTO mission_commandes (mission_id, commande_id, statut_livraison)
           VALUES ($1, $2, 'a_livrer')`,
          [missionId, cid],
        );
      }

      await client.query('COMMIT');

      // Retourner la mission complète
      return this.getMission(missionId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ─── 4.2 getMissionsToday ────────────────────────────────────────────────

  /**
   * Retourne les missions du jour (date_mission = CURRENT_DATE),
   * avec le détail des commandes jointes via mission_commandes → commandes → structures.
   * Filtre optionnel sur livreur_id.
   */
  async getMissionsToday(livreurId?: string): Promise<MissionWithCommandes[]> {
    const params: unknown[] = [];
    let whereExtra = '';
    if (livreurId) {
      params.push(livreurId);
      whereExtra = `AND m.livreur_id = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT
         m.id            AS mission_id,
         m.livreur_id,
         m.date_mission::text AS date_mission,
         m.circuit,
         m.statut_mission,
         m.started_at,
         m.completed_at,
         m.created_at,
         m.updated_at,
         mc.commande_id,
         mc.statut_livraison,
         s.nom           AS structure_nom,
         s.latitude      AS structure_latitude,
         s.longitude     AS structure_longitude,
         c.creneau::text AS creneau,
         c.montant_total
       FROM missions m
       LEFT JOIN mission_commandes mc ON mc.mission_id = m.id
       LEFT JOIN commandes          c  ON c.id = mc.commande_id
       LEFT JOIN structures          s  ON s.id = c.structure_id
       WHERE m.date_mission = CURRENT_DATE
       ${whereExtra}
       ORDER BY m.created_at, mc.commande_id`,
      params,
    );

    return this._buildMissions(rows as Record<string, unknown>[]);
  },

  // ─── 4.3 getMission ──────────────────────────────────────────────────────

  /**
   * Retourne une mission par son id avec ses commandes.
   * Lance RESOURCE_NOT_FOUND si absente.
   */
  async getMission(id: string): Promise<MissionWithCommandes> {
    const { rows } = await pool.query(
      `SELECT
         m.id            AS mission_id,
         m.livreur_id,
         m.date_mission::text AS date_mission,
         m.circuit,
         m.statut_mission,
         m.started_at,
         m.completed_at,
         m.created_at,
         m.updated_at,
         mc.commande_id,
         mc.statut_livraison,
         s.nom           AS structure_nom,
         s.latitude      AS structure_latitude,
         s.longitude     AS structure_longitude,
         c.creneau::text AS creneau,
         c.montant_total
       FROM missions m
       LEFT JOIN mission_commandes mc ON mc.mission_id = m.id
       LEFT JOIN commandes          c  ON c.id = mc.commande_id
       LEFT JOIN structures          s  ON s.id = c.structure_id
       WHERE m.id = $1
       ORDER BY mc.commande_id`,
      [id],
    );

    if (rows.length === 0) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Mission introuvable', 404);
    }

    const missions = this._buildMissions(rows as Record<string, unknown>[]);
    return missions[0];
  },

  // ─── 4.4 updateMission ───────────────────────────────────────────────────

  /**
   * Mise à jour partielle d'une mission en attente.
   * Lance MISSION_ALREADY_COMPLETED si le statut n'est plus 'en_attente'.
   * Remplace les mission_commandes si commande_ids est fourni.
   */
  async updateMission(id: string, input: UpdateMissionInput): Promise<MissionWithCommandes> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Vérifier statut
      const { rows: current } = await client.query(
        'SELECT statut_mission FROM missions WHERE id = $1',
        [id],
      );
      if (current.length === 0) {
        throw new AppError('RESOURCE_NOT_FOUND', 'Mission introuvable', 404);
      }
      if (current[0].statut_mission !== 'en_attente') {
        throw new AppError(
          'MISSION_ALREADY_COMPLETED',
          'Cette mission ne peut plus être modifiée',
          409,
        );
      }

      // Construire la clause SET
      const setClauses: string[] = ['updated_at = NOW()'];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (input.circuit !== undefined) {
        setClauses.push(`circuit = $${paramIndex++}`);
        values.push(input.circuit);
      }
      if (input.date_mission !== undefined) {
        setClauses.push(`date_mission = $${paramIndex++}`);
        values.push(input.date_mission);
      }

      if (setClauses.length > 1) {
        values.push(id);
        await client.query(
          `UPDATE missions SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
          values,
        );
      }

      // Remplacer les commandes si fourni
      if (input.commande_ids !== undefined) {
        // Vérifier existence de chaque commande
        for (const cid of input.commande_ids) {
          const { rows } = await client.query(
            'SELECT id FROM commandes WHERE id = $1',
            [cid],
          );
          if (rows.length === 0) {
            throw new AppError(
              'MISSION_COMMANDE_NOT_FOUND',
              `Commande introuvable : ${cid}`,
              404,
            );
          }
        }

        // Supprimer les anciennes lignes
        await client.query(
          'DELETE FROM mission_commandes WHERE mission_id = $1',
          [id],
        );

        // Insérer les nouvelles
        for (const cid of input.commande_ids) {
          await client.query(
            `INSERT INTO mission_commandes (mission_id, commande_id, statut_livraison)
             VALUES ($1, $2, 'a_livrer')`,
            [id, cid],
          );
        }
      }

      await client.query('COMMIT');

      return this.getMission(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ─── 4.5 cancelMission ───────────────────────────────────────────────────

  /**
   * Annule une mission.
   * Lance MISSION_ALREADY_COMPLETED si la mission est déjà terminée.
   */
  async cancelMission(id: string): Promise<void> {
    const { rows: current } = await pool.query(
      'SELECT statut_mission FROM missions WHERE id = $1',
      [id],
    );
    if (current.length === 0) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Mission introuvable', 404);
    }
    if (current[0].statut_mission === 'terminee') {
      throw new AppError(
        'MISSION_ALREADY_COMPLETED',
        'Une mission terminée ne peut pas être annulée',
        409,
      );
    }

    await pool.query(
      `UPDATE missions SET statut_mission = 'annulee', updated_at = NOW() WHERE id = $1`,
      [id],
    );
  },

  // ─── 5.1 startMission ────────────────────────────────────────────────────

  /**
   * Démarre une mission (en_attente → en_route).
   * Vérifie ownership (403 AUTH_FORBIDDEN) et statut (409 MISSION_INVALID_TRANSITION).
   * Set statut_mission = 'en_route' + started_at = NOW().
   */
  async startMission(missionId: string, livreurId: string): Promise<MissionWithCommandes> {
    const { rows } = await pool.query(
      'SELECT livreur_id, statut_mission FROM missions WHERE id = $1',
      [missionId],
    );
    if (rows.length === 0) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Mission introuvable', 404);
    }
    if (rows[0].livreur_id !== livreurId) {
      throw new AppError('AUTH_FORBIDDEN', 'Accès interdit à cette mission', 403);
    }
    if (rows[0].statut_mission !== 'en_attente') {
      throw new AppError(
        'MISSION_INVALID_TRANSITION',
        'La mission doit être en attente pour être démarrée',
        409,
      );
    }

    await pool.query(
      `UPDATE missions SET statut_mission = 'en_route', started_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [missionId],
    );

    return this.getMission(missionId);
  },

  // ─── 5.2 markCommandeLivree ──────────────────────────────────────────────

  /**
   * Marque une commande de la mission comme livrée.
   * Vérifie ownership et que la mission est en_route.
   * Set statut_livraison = 'livre' dans mission_commandes.
   */
  async markCommandeLivree(
    missionId: string,
    commandeId: string,
    livreurId: string,
  ): Promise<MissionWithCommandes> {
    const { rows } = await pool.query(
      'SELECT livreur_id, statut_mission FROM missions WHERE id = $1',
      [missionId],
    );
    if (rows.length === 0) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Mission introuvable', 404);
    }
    if (rows[0].livreur_id !== livreurId) {
      throw new AppError('AUTH_FORBIDDEN', 'Accès interdit à cette mission', 403);
    }
    if (rows[0].statut_mission !== 'en_route') {
      throw new AppError(
        'MISSION_INVALID_TRANSITION',
        'La mission doit être en route pour marquer une livraison',
        409,
      );
    }

    await pool.query(
      `UPDATE mission_commandes SET statut_livraison = 'livre'
       WHERE mission_id = $1 AND commande_id = $2`,
      [missionId, commandeId],
    );

    return this.getMission(missionId);
  },

  // ─── 5.3 completeMission ─────────────────────────────────────────────────

  /**
   * Termine une mission (en_route → terminee) dans une transaction.
   * Vérifie ownership et statut (MISSION_INVALID_TRANSITION si pas en_route).
   * Set statut_mission = 'terminee' + completed_at = NOW().
   * Set statut = 'livre' dans commandes pour tous les commande_id de la mission.
   */
  async completeMission(missionId: string, livreurId: string): Promise<MissionWithCommandes> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        'SELECT livreur_id, statut_mission FROM missions WHERE id = $1',
        [missionId],
      );
      if (rows.length === 0) {
        throw new AppError('RESOURCE_NOT_FOUND', 'Mission introuvable', 404);
      }
      if (rows[0].livreur_id !== livreurId) {
        throw new AppError('AUTH_FORBIDDEN', 'Accès interdit à cette mission', 403);
      }
      if (rows[0].statut_mission !== 'en_route') {
        throw new AppError(
          'MISSION_INVALID_TRANSITION',
          'La mission doit être en route pour être terminée',
          409,
        );
      }

      // Récupérer tous les commande_ids de la mission
      const { rows: mcRows } = await client.query(
        'SELECT commande_id FROM mission_commandes WHERE mission_id = $1',
        [missionId],
      );
      const commandeIds = mcRows.map((r: { commande_id: string }) => r.commande_id);

      // Terminer la mission
      await client.query(
        `UPDATE missions
         SET statut_mission = 'terminee', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [missionId],
      );

      // Marquer toutes les commandes comme livrées
      if (commandeIds.length > 0) {
        await client.query(
          `UPDATE commandes SET statut = 'livre'::statut_commande WHERE id = ANY($1)`,
          [commandeIds],
        );
      }

      await client.query('COMMIT');

      return this.getMission(missionId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ─── 6.1 getHistorique ───────────────────────────────────────────────────

  /**
   * Retourne l'historique paginé des missions passées d'un livreur
   * (date_mission < CURRENT_DATE), triées par date_mission DESC.
   * Pagination : 20 par page (LIMIT 20 OFFSET (page-1)*20).
   * Retourne { missions, total }.
   */
  async getHistorique(livreurId: string, page: number): Promise<HistoriqueResult> {
    const limit = 20;
    const offset = (page - 1) * limit;

    // Compter le total de missions (pas de lignes)
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total
       FROM missions
       WHERE livreur_id = $1 AND date_mission < CURRENT_DATE`,
      [livreurId],
    );
    const total = Number(countRows[0].total);

    // Charger les missions avec leurs commandes
    const { rows } = await pool.query(
      `SELECT
         m.id            AS mission_id,
         m.livreur_id,
         m.date_mission::text AS date_mission,
         m.circuit,
         m.statut_mission,
         m.started_at,
         m.completed_at,
         m.created_at,
         m.updated_at,
         mc.commande_id,
         mc.statut_livraison,
         s.nom           AS structure_nom,
         s.latitude      AS structure_latitude,
         s.longitude     AS structure_longitude,
         c.creneau::text AS creneau,
         c.montant_total
       FROM (
         SELECT id FROM missions
         WHERE livreur_id = $1 AND date_mission < CURRENT_DATE
         ORDER BY date_mission DESC
         LIMIT $2 OFFSET $3
       ) sub
       JOIN missions       m  ON m.id = sub.id
       LEFT JOIN mission_commandes mc ON mc.mission_id = m.id
       LEFT JOIN commandes          c  ON c.id = mc.commande_id
       LEFT JOIN structures          s  ON s.id = c.structure_id
       ORDER BY m.date_mission DESC, mc.commande_id`,
      [livreurId, limit, offset],
    );

    const missions = this._buildMissions(rows as Record<string, unknown>[]);

    return { missions, total };
  },
};

export interface HistoriqueResult {
  missions: MissionWithCommandes[];
  total: number;
}

export default LivreurService;
