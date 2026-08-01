import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import pool from '../../db/pool';

const router = Router();

router.use(authenticate, requireAdmin);

// GET /admin/rotation-logs
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, date_jour::text, statut, message, executed_at
       FROM rotation_logs
       ORDER BY executed_at DESC
       LIMIT 90`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
