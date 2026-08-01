import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireLivreur } from '../middleware/auth';
import { LivreurService } from '../services/livreurService';

const router = Router();

// 11.1 — Middleware global : authentification + rôle livreur requis
router.use(authenticate, requireLivreur);

// ── 11.2 — GET /missions/today → missions du jour pour le livreur connecté ──
router.get('/missions/today', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const missions = await LivreurService.getMissionsToday(req.userId);
    res.json(missions);
  } catch (err) {
    next(err);
  }
});

// ── 11.3 — GET /missions/historique?page=1 → historique paginé ──────────────
router.get('/missions/historique', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const result = await LivreurService.getHistorique(req.userId!, page);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── 11.4 — POST /missions/:id/start → démarrer une mission ──────────────────
router.post('/missions/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mission = await LivreurService.startMission(req.params.id, req.userId!);
    res.json(mission);
  } catch (err) {
    next(err);
  }
});

// ── 11.5 — POST /missions/:id/commandes/:commandeId/livre → marquer livrée ──
router.post(
  '/missions/:id/commandes/:commandeId/livre',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mission = await LivreurService.markCommandeLivree(
        req.params.id,
        req.params.commandeId,
        req.userId!,
      );
      res.json(mission);
    } catch (err) {
      next(err);
    }
  },
);

// ── 11.6 — POST /missions/:id/complete → terminer une mission ───────────────
router.post('/missions/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mission = await LivreurService.completeMission(req.params.id, req.userId!);
    res.json(mission);
  } catch (err) {
    next(err);
  }
});

export default router;
