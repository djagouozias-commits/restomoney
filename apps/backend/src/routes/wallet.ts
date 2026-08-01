import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import multer from 'multer';
import { authenticate, structureScope } from '../middleware/auth';
import WalletService from '../services/walletService';

const router = Router();

// Upload captures de dépôt
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/wallet-captures'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `depot-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez JPG, PNG ou WebP.'));
    }
  },
});

router.use(authenticate, structureScope);

// GET /api/v1/wallet — solde + info wallet
router.get('/', async (req, res, next) => {
  try {
    const wallet = await WalletService.getWalletByStructure(req.structureId!);
    res.json(wallet);
  } catch (err) { next(err); }
});

// GET /api/v1/wallet/transactions — historique paginé de la structure
router.get('/transactions', async (req, res, next) => {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const result = await WalletService.getTransactions(req.structureId!, page, limit);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/v1/wallet/payer — débit avec confirmation mot de passe
const payerSchema = z.object({
  montant: z.number().int().positive(),
  password: z.string().min(1),
});

router.post('/payer', async (req, res, next) => {
  try {
    const parsed = payerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: 'VALIDATION_ERROR', details: parsed.error.format() });
      return;
    }
    const tx = await WalletService.debiter(
      req.structureId!,
      parsed.data.montant,
      parsed.data.password,
    );
    res.status(201).json(tx);
  } catch (err) { next(err); }
});

// GET /api/v1/wallet/demandes — demandes de la structure
router.get('/demandes', async (req, res, next) => {
  try {
    const demandes = await WalletService.getDemandes(req.structureId!);
    res.json(demandes);
  } catch (err) { next(err); }
});

// POST /api/v1/wallet/demandes — soumettre une demande avec capture de dépôt
router.post('/demandes', upload.single('capture'), async (req, res, next) => {
  try {
    const montant_demande = parseInt(req.body.montant_demande, 10);
    const notes = req.body.notes || undefined;

    if (!montant_demande || montant_demande <= 0) {
      res.status(400).json({ error: { code: 'WALLET_INVALID_AMOUNT', message: 'Montant invalide' } });
      return;
    }

    const capture_url = req.file
      ? `/uploads/wallet-captures/${req.file.filename}`
      : undefined;

    const demande = await WalletService.soumettreDemandeComplement(
      req.structureId!,
      {
        montant_demande,
        adresse_collecte: req.body.adresse_collecte || 'Mobile Money',
        contact: req.body.contact || '',
        notes,
        capture_url,
      } as any,
    );
    res.status(201).json(demande);
  } catch (err) { next(err); }
});

export default router;
