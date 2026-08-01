import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import PlanningService from '../../services/planningService';

const router = Router();

const PlanningEntrySchema = z.object({
  jour_semaine: z.number().int().min(0).max(6),
  position: z.number().int().min(1).max(3),
  plat_id: z.string().uuid(),
});

const SurchargeSchema = z.object({
  date_jour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  position: z.number().int().min(1).max(3),
  plat_id: z.string().uuid(),
});

router.use(authenticate, requireAdmin);

// GET /admin/planning
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await PlanningService.getPlanning());
  } catch (err) { next(err); }
});

// PUT /admin/planning
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = z.array(PlanningEntrySchema).parse(req.body);
    await PlanningService.savePlanning(entries);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /admin/planning/surcharges
router.get('/surcharges', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await PlanningService.getSurcharges());
  } catch (err) { next(err); }
});

// POST /admin/planning/surcharges
router.post('/surcharges', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = SurchargeSchema.parse(req.body);
    const surcharge = await PlanningService.createSurcharge(data);
    res.status(201).json(surcharge);
  } catch (err) { next(err); }
});

// DELETE /admin/planning/surcharges/:id
router.delete('/surcharges/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await PlanningService.deleteSurcharge(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
