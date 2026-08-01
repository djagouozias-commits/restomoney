import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import MenuService from '../../services/menuService';

const router = Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../../uploads/plats'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `menu-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const OptionSchema = z.object({
  nom: z.string().min(1),
  position: z.number().int().positive(),
});

const ComposantSchema = z.object({
  nom: z.string().min(1),
  a_choix: z.boolean(),
  position: z.number().int().positive(),
  options: z.array(OptionSchema).optional().default([]),
});

const MenuSchema = z.object({
  nom: z.string().min(1).max(255),
  description: z.string().optional(),
  prix: z.coerce.number().positive(),
  composants: z.array(ComposantSchema).optional().default([]),
});

router.use(authenticate, requireAdmin);

// GET /admin/menus
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await MenuService.list());
  } catch (err) { next(err); }
});

// POST /admin/menus
router.post('/', upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = MenuSchema.parse(
      typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body,
    );
    const image_url = req.file ? `/uploads/plats/${req.file.filename}` : undefined;
    const menu = await MenuService.create({ ...data, image_url });
    res.status(201).json(menu);
  } catch (err) { next(err); }
});

// PUT /admin/menus/:id
router.put('/:id', upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = MenuSchema.partial().parse(
      typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body,
    );
    const image_url = req.file ? `/uploads/plats/${req.file.filename}` : undefined;
    const menu = await MenuService.update(req.params.id, {
      ...data,
      ...(image_url ? { image_url } : {}),
    });
    res.json(menu);
  } catch (err) { next(err); }
});

// PATCH /admin/menus/:id/toggle
router.patch('/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await MenuService.toggle(req.params.id));
  } catch (err) { next(err); }
});

// DELETE /admin/menus/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await MenuService.delete(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
