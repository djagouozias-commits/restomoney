import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import SignalementService from '../../services/signalementService';

const router = Router();
router.use(authenticate, requireAdmin);

// GET /admin/signalements — tous les signalements
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const signalements = await SignalementService.listAll(200);
    res.json(signalements);
  } catch (err) { next(err); }
});

export default router;
