import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, structureScope } from '../middleware/auth';
import CommandeService from '../services/commandeService';

const router = Router();

router.use(authenticate, structureScope);

const SelectionOptionSchema = z.object({
  composant_id: z.string().uuid(),
  option_id: z.string().uuid(),
});

const LigneCommandeSchema = z.object({
  type: z.enum(['plat', 'menu']),
  plat_id: z.string().uuid().optional(),
  menu_complet_id: z.string().uuid().optional(),
  quantite: z.number().int().positive(),
  selections_options: z.array(SelectionOptionSchema).optional().default([]),
  jetable: z.boolean().optional().default(false),
  variante_id: z.string().uuid().optional(),
});

const CommandeSchema = z.object({
  creneau: z.string().regex(/^\d{2}:\d{2}$/),
  lignes: z.array(LigneCommandeSchema).min(1),
  mode_paiement: z.enum(['especes', 'wallet']).default('especes'),
  password: z.string().optional(),
});

// POST /commandes
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CommandeSchema.parse(req.body);
    const commande = await CommandeService.create(
      req.structureId!,
      data,
      req.employeId,
      req.userId, // login de l'employé ou de la structure
      req.role === 'employe' ? 'employe' : 'structure',
    );
    res.status(201).json(commande);
  } catch (err) { next(err); }
});

// GET /commandes
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const commandes = await CommandeService.listByStructure(req.structureId!);
    res.json(commandes);
  } catch (err) { next(err); }
});

// GET /commandes/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const commande = await CommandeService.getById(req.params.id, req.structureId!);
    res.json(commande);
  } catch (err) { next(err); }
});

export default router;
