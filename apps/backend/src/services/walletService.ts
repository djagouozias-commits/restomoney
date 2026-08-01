import bcrypt from 'bcrypt';
import pool from '../db/pool';
import { AppError } from '../utils/errors';
import type {
  Wallet,
  Transaction,
  TransactionPage,
  TransactionType,
  Demande,
  DemandeInput,
  DemandeStatut,
} from '../types/wallet';
import type { PoolClient } from 'pg';

// Machine à états des demandes
const TRANSITIONS: Record<DemandeStatut, DemandeStatut[]> = {
  en_attente:        ['acceptee', 'refusee'],
  acceptee:          ['collecte_en_cours'],
  collecte_en_cours: ['completee'],
  completee:         [],
  refusee:           [],
};

export const WalletService = {
  // ─── Lecture ───────────────────────────────────────────────────────────────

  async getWalletByStructure(structureId: string): Promise<Wallet> {
    const { rows } = await pool.query<Wallet>(
      `SELECT id, structure_id, solde, created_at, updated_at
       FROM wallets WHERE structure_id = $1`,
      [structureId],
    );
    if (rows.length === 0) {
      throw new AppError('WALLET_NOT_FOUND', 'Wallet introuvable pour cette structure', 404);
    }
    return rows[0];
  },

  async getAllWallets(): Promise<Array<Wallet & { structure_nom: string }>> {
    const { rows } = await pool.query(
      `SELECT w.id, w.structure_id, w.solde, w.created_at, w.updated_at,
              s.nom as structure_nom
       FROM wallets w
       JOIN structures s ON s.id = w.structure_id
       ORDER BY s.nom ASC`,
    );
    return rows;
  },

  async getTransactions(structureId: string, page = 1, limit = 20): Promise<TransactionPage> {
    const offset = (page - 1) * limit;
    const { rows: wallet } = await pool.query<{ id: string }>(
      'SELECT id FROM wallets WHERE structure_id = $1',
      [structureId],
    );
    if (wallet.length === 0) {
      throw new AppError('WALLET_NOT_FOUND', 'Wallet introuvable', 404);
    }
    const walletId = wallet[0].id;

    const { rows } = await pool.query<Transaction>(
      `SELECT id, wallet_id, type, montant, solde_avant, solde_apres,
              admin_id, reference, created_at
       FROM wallet_transactions
       WHERE wallet_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [walletId, limit, offset],
    );

    const { rows: countRows } = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text as count FROM wallet_transactions WHERE wallet_id = $1',
      [walletId],
    );

    return {
      items: rows,
      total: parseInt(countRows[0].count, 10),
      page,
      limit,
    };
  },

  async getAllTransactions(page = 1, limit = 20, structureId?: string): Promise<TransactionPage> {
    const offset = (page - 1) * limit;

    const whereClause = structureId
      ? 'WHERE w.structure_id = $3'
      : '';
    const params: unknown[] = structureId
      ? [limit, offset, structureId]
      : [limit, offset];

    const { rows } = await pool.query<Transaction>(
      `SELECT wt.id, wt.wallet_id, wt.type, wt.montant, wt.solde_avant,
              wt.solde_apres, wt.admin_id, wt.reference, wt.created_at
       FROM wallet_transactions wt
       JOIN wallets w ON w.id = wt.wallet_id
       ${whereClause}
       ORDER BY wt.created_at DESC
       LIMIT $1 OFFSET $2`,
      params,
    );

    const countParams: unknown[] = structureId ? [structureId] : [];
    const countWhere = structureId ? 'WHERE w.structure_id = $1' : '';
    const { rows: countRows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM wallet_transactions wt
       JOIN wallets w ON w.id = wt.wallet_id
       ${countWhere}`,
      countParams,
    );

    return {
      items: rows,
      total: parseInt(countRows[0].count, 10),
      page,
      limit,
    };
  },

  // ─── Création ──────────────────────────────────────────────────────────────

  async createWalletForStructure(structureId: string, client: PoolClient): Promise<Wallet> {
    const { rows } = await client.query<Wallet>(
      `INSERT INTO wallets (structure_id, solde)
       VALUES ($1, 0)
       RETURNING id, structure_id, solde, created_at, updated_at`,
      [structureId],
    );
    return rows[0];
  },

  // ─── Recharge (admin) ──────────────────────────────────────────────────────

  async recharge(structureId: string, montant: number, adminId: string): Promise<Transaction> {
    if (!Number.isInteger(montant) || montant <= 0) {
      throw new AppError('WALLET_INVALID_AMOUNT', 'Le montant doit être un entier strictement positif', 422);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: walletRows } = await client.query<Wallet>(
        'SELECT id, solde FROM wallets WHERE structure_id = $1 FOR UPDATE',
        [structureId],
      );
      if (walletRows.length === 0) {
        throw new AppError('WALLET_NOT_FOUND', 'Wallet introuvable', 404);
      }

      const wallet = walletRows[0];
      const soldeBefore = Number(wallet.solde);
      const soldeAfter = soldeBefore + montant;

      await client.query(
        'UPDATE wallets SET solde = $1, updated_at = NOW() WHERE id = $2',
        [soldeAfter, wallet.id],
      );

      const { rows: txRows } = await client.query<Transaction>(
        `INSERT INTO wallet_transactions
           (wallet_id, type, montant, solde_avant, solde_apres, admin_id)
         VALUES ($1, 'recharge', $2, $3, $4, $5)
         RETURNING id, wallet_id, type, montant, solde_avant, solde_apres,
                   admin_id, reference, created_at`,
        [wallet.id, montant, soldeBefore, soldeAfter, adminId],
      );

      await client.query('COMMIT');
      return txRows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      if (err instanceof AppError) throw err;
      throw new AppError('WALLET_TRANSACTION_FAILED', 'La transaction a échoué', 500);
    } finally {
      client.release();
    }
  },

  // ─── Débit interne (commande) ──────────────────────────────────────────────

  async debiterPourCommande(structureId: string, montant: number, commandeId: string): Promise<void> {
    const montantInt = Math.round(montant);
    if (montantInt <= 0) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: walletRows } = await client.query<Wallet>(
        'SELECT id, solde FROM wallets WHERE structure_id = $1 FOR UPDATE',
        [structureId],
      );
      if (walletRows.length === 0) {
        await client.query('ROLLBACK');
        throw new AppError('WALLET_NOT_FOUND', 'Wallet introuvable', 404);
      }

      const wallet = walletRows[0];
      const soldeBefore = Number(wallet.solde);

      if (soldeBefore < montantInt) {
        await client.query('ROLLBACK');
        throw new AppError(
          'WALLET_INSUFFICIENT_FUNDS',
          `Solde insuffisant : ${soldeBefore} FCFA disponibles, ${montantInt} FCFA demandés`,
          422,
        );
      }

      const soldeAfter = soldeBefore - montantInt;

      await client.query(
        'UPDATE wallets SET solde = $1, updated_at = NOW() WHERE id = $2',
        [soldeAfter, wallet.id],
      );

      await client.query(
        `INSERT INTO wallet_transactions
           (wallet_id, type, montant, solde_avant, solde_apres, reference)
         VALUES ($1, 'debit', $2, $3, $4, $5)`,
        [wallet.id, montantInt, soldeBefore, soldeAfter, commandeId],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err instanceof AppError) throw err;
      throw new AppError('WALLET_TRANSACTION_FAILED', 'La transaction a échoué', 500);
    } finally {
      client.release();
    }
  },

  // ─── Débit (structure avec MDP) ────────────────────────────────────────────

  async debiter(structureId: string, montant: number, password: string): Promise<Transaction> {
    if (!Number.isInteger(montant) || montant <= 0) {
      throw new AppError('WALLET_INVALID_AMOUNT', 'Le montant doit être un entier strictement positif', 422);
    }

    // Vérifier MDP avant d'acquérir le verrou
    const { rows: structRows } = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM structures WHERE id = $1',
      [structureId],
    );
    if (structRows.length === 0) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Structure introuvable', 401);
    }
    const valid = await bcrypt.compare(password, structRows[0].password_hash);
    if (!valid) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Mot de passe incorrect', 401);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: walletRows } = await client.query<Wallet>(
        'SELECT id, solde FROM wallets WHERE structure_id = $1 FOR UPDATE',
        [structureId],
      );
      if (walletRows.length === 0) {
        throw new AppError('WALLET_NOT_FOUND', 'Wallet introuvable', 404);
      }

      const wallet = walletRows[0];
      const soldeBefore = Number(wallet.solde);

      if (soldeBefore < montant) {
        await client.query('ROLLBACK');
        throw new AppError(
          'WALLET_INSUFFICIENT_FUNDS',
          `Solde insuffisant : ${soldeBefore} FCFA disponibles, ${montant} FCFA demandés`,
          422,
        );
      }

      const soldeAfter = soldeBefore - montant;

      await client.query(
        'UPDATE wallets SET solde = $1, updated_at = NOW() WHERE id = $2',
        [soldeAfter, wallet.id],
      );

      const { rows: txRows } = await client.query<Transaction>(
        `INSERT INTO wallet_transactions
           (wallet_id, type, montant, solde_avant, solde_apres)
         VALUES ($1, 'debit', $2, $3, $4)
         RETURNING id, wallet_id, type, montant, solde_avant, solde_apres,
                   admin_id, reference, created_at`,
        [wallet.id, montant, soldeBefore, soldeAfter],
      );

      await client.query('COMMIT');
      return txRows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      if (err instanceof AppError) throw err;
      throw new AppError('WALLET_TRANSACTION_FAILED', 'La transaction a échoué', 500);
    } finally {
      client.release();
    }
  },

  // ─── Demandes de complément de fonds ───────────────────────────────────────

  async soumettreDemandeComplement(structureId: string, input: DemandeInput & { capture_url?: string }): Promise<Demande> {
    if (!Number.isInteger(input.montant_demande) || input.montant_demande <= 0) {
      throw new AppError('WALLET_INVALID_AMOUNT', 'Le montant demandé doit être un entier strictement positif', 422);
    }

    const { rows } = await pool.query<Demande>(
      `INSERT INTO wallet_demandes
         (structure_id, montant_demande, adresse_collecte, contact, notes, capture_url, statut)
       VALUES ($1, $2, $3, $4, $5, $6, 'en_attente')
       RETURNING id, structure_id, montant_demande, adresse_collecte, contact,
                 notes, capture_url, statut, motif_refus, admin_id, created_at, updated_at`,
      [
        structureId,
        input.montant_demande,
        input.adresse_collecte || 'Mobile Money',
        input.contact || '',
        input.notes?.trim() || null,
        input.capture_url || null,
      ],
    );
    return rows[0];
  },

  async updateDemandeStatut(
    demandeId: string,
    newStatut: DemandeStatut,
    motif?: string,
    adminId?: string,
  ): Promise<Demande> {
    const { rows: currentRows } = await pool.query<Demande>(
      'SELECT * FROM wallet_demandes WHERE id = $1',
      [demandeId],
    );
    if (currentRows.length === 0) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Demande introuvable', 404);
    }
    const demande = currentRows[0];
    const allowedNext = TRANSITIONS[demande.statut];

    if (!allowedNext.includes(newStatut)) {
      throw new AppError(
        'WALLET_INVALID_TRANSITION',
        `Transition invalide : ${demande.statut} → ${newStatut}`,
        422,
      );
    }

    // Si complétion : créditer le wallet dans la même transaction
    if (newStatut === 'completee') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const { rows: walletRows } = await client.query<Wallet>(
          'SELECT id, solde FROM wallets WHERE structure_id = $1 FOR UPDATE',
          [demande.structure_id],
        );
        if (walletRows.length === 0) {
          throw new AppError('WALLET_NOT_FOUND', 'Wallet introuvable', 404);
        }
        const wallet = walletRows[0];
        const soldeBefore = Number(wallet.solde);
        const montant = Number(demande.montant_demande);
        const soldeAfter = soldeBefore + montant;

        await client.query(
          'UPDATE wallets SET solde = $1, updated_at = NOW() WHERE id = $2',
          [soldeAfter, wallet.id],
        );

        await client.query(
          `INSERT INTO wallet_transactions
             (wallet_id, type, montant, solde_avant, solde_apres, admin_id, reference)
           VALUES ($1, 'credit_demande', $2, $3, $4, $5, $6)`,
          [wallet.id, montant, soldeBefore, soldeAfter, adminId || null, demandeId],
        );

        const { rows: updatedRows } = await client.query<Demande>(
          `UPDATE wallet_demandes
           SET statut = $1, motif_refus = $2, admin_id = $3, updated_at = NOW()
           WHERE id = $4
           RETURNING id, structure_id, montant_demande, adresse_collecte, contact,
                     notes, statut, motif_refus, admin_id, created_at, updated_at`,
          [newStatut, motif || null, adminId || null, demandeId],
        );

        await client.query('COMMIT');
        return updatedRows[0];
      } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof AppError) throw err;
        throw new AppError('WALLET_TRANSACTION_FAILED', 'La transaction a échoué', 500);
      } finally {
        client.release();
      }
    }

    // Autres transitions : simple UPDATE
    const { rows } = await pool.query<Demande>(
      `UPDATE wallet_demandes
       SET statut = $1, motif_refus = $2, admin_id = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, structure_id, montant_demande, adresse_collecte, contact,
                 notes, statut, motif_refus, admin_id, created_at, updated_at`,
      [newStatut, motif || null, adminId || null, demandeId],
    );
    return rows[0];
  },

  async getDemandes(structureId: string): Promise<Demande[]> {
    const { rows } = await pool.query<Demande>(
      `SELECT id, structure_id, montant_demande, adresse_collecte, contact,
              notes, statut, motif_refus, admin_id, created_at, updated_at
       FROM wallet_demandes
       WHERE structure_id = $1
       ORDER BY created_at DESC`,
      [structureId],
    );
    return rows;
  },

  async getAllDemandes(): Promise<Demande[]> {
    const { rows } = await pool.query<Demande>(
      `SELECT d.id, d.structure_id, d.montant_demande, d.adresse_collecte,
              d.contact, d.notes, d.capture_url, d.statut, d.motif_refus, d.admin_id,
              d.created_at, d.updated_at, s.nom as structure_nom
       FROM wallet_demandes d
       JOIN structures s ON s.id = d.structure_id
       ORDER BY d.created_at DESC`,
    );
    return rows;
  },
};

export default WalletService;
