import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import EmployeService from '../../services/employeService';

// ── Router monté sur /admin/structures ──────────────────────────────────────
const router = Router();
router.use(authenticate, requireAdmin);

// GET /admin/structures/:structureId/employes
router.get('/:structureId/employes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employes = await EmployeService.listByStructure(req.params.structureId);
    res.json(employes);
  } catch (err) { next(err); }
});

// POST /admin/structures/:structureId/employes
router.post('/:structureId/employes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom } = z.object({ nom: z.string().optional() }).parse(req.body);
    const result = await EmployeService.create(req.params.structureId, nom);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

export default router;

// ── Router monté sur /admin/employes ─────────────────────────────────────────
export const employeActionsRouter = Router();
employeActionsRouter.use(authenticate, requireAdmin);

// PATCH /admin/employes/:id/toggle
employeActionsRouter.patch('/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await EmployeService.toggle(req.params.id));
  } catch (err) { next(err); }
});

// POST /admin/employes/:id/reset-password
employeActionsRouter.post('/:id/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await EmployeService.resetPassword(req.params.id));
  } catch (err) { next(err); }
});

// DELETE /admin/employes/:id
employeActionsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await EmployeService.delete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
