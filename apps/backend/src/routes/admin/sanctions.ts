import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AppError } from '../../utils/errors';
import SanctionService from '../../services/sanctionService';

const router = Router();

router.use(authenticate, requireAdmin);

// GET /admin/sanctions/parametres — liste des paramètres de sanction (niveaux 1–4)
// Requirements: 5.1
router.get('/parametres', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await SanctionService.getParametres();
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/sanctions/parametres/:niveau — mise à jour d'un paramètre de sanction
// Requirements: 1.3, 1.4, 1.5
router.patch('/parametres/:niveau', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const niveau = parseInt(req.params.niveau, 10);

    if (isNaN(niveau)) {
      return next(new AppError('VALIDATION_ERROR', 'Le paramètre niveau doit être un entier', 422));
    }

    const { reduction_pct, min_minutes, max_minutes, emettre_bon } = req.body;

    // Validation : reduction_pct ∈ [0, 100]
    if (reduction_pct !== undefined) {
      const pct = Number(reduction_pct);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return next(
          new AppError('VALIDATION_ERROR', 'reduction_pct doit être compris entre 0 et 100', 422),
        );
      }
    }

    // Validation : min_minutes ≥ 0
    if (min_minutes !== undefined) {
      const min = Number(min_minutes);
      if (isNaN(min) || min < 0) {
        return next(
          new AppError('VALIDATION_ERROR', 'min_minutes ne peut pas être négatif', 422),
        );
      }
    }

    const patch: Record<string, unknown> = {};
    if (reduction_pct !== undefined) patch.reduction_pct = Number(reduction_pct);
    if (min_minutes !== undefined) patch.min_minutes = Number(min_minutes);
    if (max_minutes !== undefined) patch.max_minutes = max_minutes === null ? null : Number(max_minutes);
    if (emettre_bon !== undefined) patch.emettre_bon = Boolean(emettre_bon);

    const updated = await SanctionService.updateParametre(niveau, patch);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /admin/sanctions/bons — liste des bons de réduction avec filtres optionnels
// Requirements: 5.4, 5.5
router.get('/bons', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const structure_id =
      typeof req.query.structure_id === 'string' ? req.query.structure_id : undefined;
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;

    const rows = await SanctionService.getBons({ structure_id, date });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /admin/sanctions/historique — historique des sanctions avec filtres optionnels
// Requirements: 6.3
router.get('/historique', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const structure_id =
      typeof req.query.structure_id === 'string' ? req.query.structure_id : undefined;

    const rows = await SanctionService.getHistorique({ date, structure_id });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
