import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import PlatService from '../../services/platService';

const router = Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../../uploads/plats'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const CreatePlatSchema = z.object({
  nom: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  prix: z.coerce.number().positive(),
  avec_jetable: z.coerce.boolean().optional(),
});

router.use(authenticate, requireAdmin);

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json(await PlatService.list()); } catch (err) { next(err); }
});

router.post('/', upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreatePlatSchema.parse(req.body);
    const image_url = req.file ? `/uploads/plats/${req.file.filename}` : undefined;
    const plat = await PlatService.create({ ...data, image_url });
    res.status(201).json(plat);
  } catch (err) { next(err); }
});

router.put('/:id', upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreatePlatSchema.partial().parse(req.body);
    const image_url = req.file ? `/uploads/plats/${req.file.filename}` : undefined;
    const plat = await PlatService.update(req.params.id, { ...data, ...(image_url ? { image_url } : {}), ...(data.avec_jetable !== undefined ? { avec_jetable: data.avec_jetable } : {}) });
    res.json(plat);
  } catch (err) { next(err); }
});

router.patch('/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await PlatService.toggle(req.params.id)); } catch (err) { next(err); }
});

router.patch('/:id/jetable', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await PlatService.toggleJetable(req.params.id)); } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await PlatService.delete(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

// ─── Variantes ──────────────────────────────────────────────────────────────

const VarianteSchema = z.object({
  libelle: z.string().min(1).max(255),
  prix: z.coerce.number().positive(),
});

router.get('/:id/variantes', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await PlatService.listVariantes(req.params.id)); } catch (err) { next(err); }
});

router.post('/:id/variantes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = VarianteSchema.parse(req.body);
    const variante = await PlatService.createVariante(req.params.id, data);
    res.status(201).json(variante);
  } catch (err) { next(err); }
});

router.put('/:id/variantes/:varianteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = VarianteSchema.partial().parse(req.body);
    const variante = await PlatService.updateVariante(req.params.id, req.params.varianteId, data);
    res.json(variante);
  } catch (err) { next(err); }
});

router.delete('/:id/variantes/:varianteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await PlatService.deleteVariante(req.params.id, req.params.varianteId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
