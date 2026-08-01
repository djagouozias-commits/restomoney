import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import TourneeService from '../../services/tourneeService';

const router = Router();

router.use(authenticate, requireAdmin);

// GET /admin/tournees
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, creneau } = req.query;
    res.json(await TourneeService.list({
      date: date as string | undefined,
      creneau: creneau as string | undefined,
    }));
  } catch (err) { next(err); }
});

// POST /admin/tournees
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { creneau, date } = z.object({
      creneau: z.string().regex(/^\d{2}:\d{2}$/),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(req.body);
    const tournee = await TourneeService.create(creneau, date);
    res.status(201).json(tournee);
  } catch (err) { next(err); }
});

// GET /admin/tournees/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await TourneeService.getById(req.params.id));
  } catch (err) { next(err); }
});

// PUT /admin/tournees/:id/ordre
router.put('/:id/ordre', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ordre } = z.object({
      ordre: z.array(z.object({
        structure_id: z.string().uuid(),
        ordre: z.number().int().positive(),
      })),
    }).parse(req.body);
    const tournee = await TourneeService.reordonner(req.params.id, ordre);
    res.json(tournee);
  } catch (err) { next(err); }
});

// PATCH /admin/tournees/:id/structures/:sid
router.patch('/:id/structures/:sid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await TourneeService.marquerLivraison(req.params.id, req.params.sid);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
