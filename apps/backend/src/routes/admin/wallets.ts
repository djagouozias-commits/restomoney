import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import WalletService from '../../services/walletService';
import type { DemandeStatut } from '../../types/wallet';

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/v1/admin/wallets — liste tous les wallets avec solde
router.get('/', async (_req, res, next) => {
  try {
    const wallets = await WalletService.getAllWallets();
    res.json(wallets);
  } catch (err) { next(err); }
});

// GET /api/v1/admin/wallets/transactions — historique global paginé
router.get('/transactions', async (req, res, next) => {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const structureId = typeof req.query.structureId === 'string' ? req.query.structureId : undefined;
    const result = await WalletService.getAllTransactions(page, limit, structureId);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/v1/admin/wallets/demandes — toutes les demandes
router.get('/demandes', async (_req, res, next) => {
  try {
    const demandes = await WalletService.getAllDemandes();
    res.json(demandes);
  } catch (err) { next(err); }
});

// PATCH /api/v1/admin/wallets/demandes/:id/statut — changer le statut d'une demande
const updateStatutSchema = z.object({
  statut: z.enum(['acceptee', 'refusee', 'collecte_en_cours', 'completee']),
  motif: z.string().optional(),
});

router.patch('/demandes/:id/statut', async (req, res, next) => {
  try {
    const parsed = updateStatutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: 'VALIDATION_ERROR', details: parsed.error.format() });
      return;
    }
    const demande = await WalletService.updateDemandeStatut(
      req.params.id,
      parsed.data.statut as DemandeStatut,
      parsed.data.motif,
      req.userId,
    );
    res.json(demande);
  } catch (err) { next(err); }
});

// GET /api/v1/admin/wallets/:structureId — détail wallet d'une structure
router.get('/:structureId', async (req, res, next) => {
  try {
    const wallet = await WalletService.getWalletByStructure(req.params.structureId);
    res.json(wallet);
  } catch (err) { next(err); }
});

// POST /api/v1/admin/wallets/:structureId/recharge
const rechargeSchema = z.object({
  montant: z.number().int().positive(),
});

router.post('/:structureId/recharge', async (req, res, next) => {
  try {
    const parsed = rechargeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: 'VALIDATION_ERROR', details: parsed.error.format() });
      return;
    }
    const tx = await WalletService.recharge(
      req.params.structureId,
      parsed.data.montant,
      req.userId!,
    );
    res.status(201).json(tx);
  } catch (err) { next(err); }
});

export default router;
