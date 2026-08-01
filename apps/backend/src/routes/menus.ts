import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import MenuService from '../services/menuService';

const router = Router();

router.use(authenticate);

// GET /menus — menus actifs avec composants et options
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const menus = await MenuService.list();
    res.json(menus.filter((m) => m.actif));
  } catch (err) { next(err); }
});

export default router;
