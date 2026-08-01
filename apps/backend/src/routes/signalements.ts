import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate, structureScope } from '../middleware/auth';
import SignalementService from '../services/signalementService';

const router = Router();

// Upload photos de signalement
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/signalements'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `sig-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo max
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez JPG, PNG ou WebP.'));
    }
  },
});

router.use(authenticate, structureScope);

// POST /signalements — créer un signalement avec photo
router.post(
  '/',
  upload.single('photo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: { code: 'MISSING_PHOTO', message: 'Photo obligatoire.' } });
      }

      const { commande_id, note } = req.body;
      if (!commande_id) {
        return res.status(400).json({ error: { code: 'MISSING_COMMANDE', message: 'commande_id obligatoire.' } });
      }

      const photo_url = `/uploads/signalements/${req.file.filename}`;

      const result = await SignalementService.createSignalement({
        commande_id,
        structure_id: req.structureId!,
        employe_id: req.employeId ?? null,
        photo_url,
        note: note ?? null,
      });

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /signalements — liste les signalements de la structure
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signalements = await SignalementService.listByStructure(req.structureId!);
    res.json(signalements);
  } catch (err) {
    next(err);
  }
});

export default router;
