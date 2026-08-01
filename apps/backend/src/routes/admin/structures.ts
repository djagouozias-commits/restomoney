import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import StructureService from '../../services/structureService';

const router = Router();

const CreateSchema = z.object({
  nom: z.string().min(1).max(255),
  domaine: z.string().optional(),
  telephone: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
});

router.use(authenticate, requireAdmin);

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json(await StructureService.list()); } catch (err) { next(err); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreateSchema.parse(req.body);
    const result = await StructureService.create(data);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await StructureService.getById(req.params.id)); } catch (err) { next(err); }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreateSchema.partial().parse(req.body);
    res.json(await StructureService.update(req.params.id, data));
  } catch (err) { next(err); }
});

router.patch('/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await StructureService.toggle(req.params.id)); } catch (err) { next(err); }
});

router.post('/:id/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await StructureService.resetPassword(req.params.id)); } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await StructureService.delete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
