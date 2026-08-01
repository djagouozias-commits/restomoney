import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import MembreService from '../../services/membreService';

const router = Router();
router.use(authenticate, requireAdmin);

const MembreSchema = z.object({
  nom: z.string().min(1),
  telephone: z.string().min(1),
  whatsapp: z.string().optional().nullable(),
  poste: z.string().optional().nullable(),
});

// GET /admin/structures/:structureId/membres
router.get('/:structureId/membres', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const membres = await MembreService.listByStructure(req.params.structureId);
    res.json(membres);
  } catch (err) { next(err); }
});

// POST /admin/structures/:structureId/membres
router.post('/:structureId/membres', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = MembreSchema.parse(req.body);
    const membre = await MembreService.create(req.params.structureId, input);
    res.status(201).json(membre);
  } catch (err) { next(err); }
});

// PATCH /admin/membres/:id — avec structureId dans le body
router.patch('/membres/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { structure_id, ...rest } = req.body;
    const input = MembreSchema.partial().parse(rest);
    const membre = await MembreService.update(req.params.id, structure_id, input);
    res.json(membre);
  } catch (err) { next(err); }
});

// DELETE /admin/membres/:id
router.delete('/membres/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { structure_id } = req.body;
    await MembreService.delete(req.params.id, structure_id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
