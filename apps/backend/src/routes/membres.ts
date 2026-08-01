import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, structureScope } from '../middleware/auth';
import MembreService from '../services/membreService';

const router = Router();
router.use(authenticate, structureScope);

const MembreSchema = z.object({
  nom: z.string().min(1),
  telephone: z.string().min(1),
  whatsapp: z.string().optional().nullable(),
  poste: z.string().optional().nullable(),
});

// GET /membres — liste les membres de la structure connectée
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const membres = await MembreService.listByStructure(req.structureId!);
    res.json(membres);
  } catch (err) { next(err); }
});

// POST /membres — créer un membre
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = MembreSchema.parse(req.body);
    const membre = await MembreService.create(req.structureId!, input);
    res.status(201).json(membre);
  } catch (err) { next(err); }
});

// PATCH /membres/:id — mettre à jour un membre
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = MembreSchema.partial().parse(req.body);
    const membre = await MembreService.update(req.params.id, req.structureId!, input);
    res.json(membre);
  } catch (err) { next(err); }
});

// DELETE /membres/:id — supprimer un membre
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await MembreService.delete(req.params.id, req.structureId!);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /membres/:id/toggle — activer/désactiver
router.patch('/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const membre = await MembreService.toggle(req.params.id, req.structureId!);
    res.json(membre);
  } catch (err) { next(err); }
});

export default router;
