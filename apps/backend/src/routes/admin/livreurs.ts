import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { LivreurService } from '../../services/livreurService';

const router = Router();

// 9.1 — Middleware global : authentification + rôle admin requis
router.use(authenticate, requireAdmin);

// ── 9.2 — GET / → liste tous les livreurs ────────────────────────────────────
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const livreurs = await LivreurService.listLivreurs();
    res.json(livreurs);
  } catch (err) {
    next(err);
  }
});

// ── 9.3 — POST / → créer un livreur ──────────────────────────────────────────
const createLivreurSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  nom: z.string().min(1),
  zone_habituelle: z.string().min(1),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createLivreurSchema.parse(req.body);
    const livreur = await LivreurService.createLivreur(input);
    res.status(201).json(livreur);
  } catch (err) {
    next(err);
  }
});

// ── 9.4 — PATCH /:id → mise à jour partielle d'un livreur ───────────────────
const updateLivreurSchema = z.object({
  nom: z.string().min(1).optional(),
  zone_habituelle: z.string().min(1).optional(),
  actif: z.boolean().optional(),
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateLivreurSchema.parse(req.body);
    const livreur = await LivreurService.updateLivreur(req.params.id, input);
    res.json(livreur);
  } catch (err) {
    next(err);
  }
});

// ── 9.5 — POST /:id/reset-password → réinitialiser le mot de passe ──────────
router.post('/:id/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await LivreurService.resetPassword(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── 9.6 — POST /:id/deactivate → désactiver un livreur ──────────────────────
router.post('/:id/deactivate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await LivreurService.deactivateLivreur(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
