import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import pool from '../../db/pool';
import { LivreurService, MissionWithCommandes } from '../../services/livreurService';

const router = Router();

// Task 10.1 — authenticate + requireAdmin on all routes
router.use(authenticate, requireAdmin);

// Task 10.6 — GET /commandes-par-zone?date=YYYY-MM-DD
// MUST be defined BEFORE /:id to avoid Express treating 'commandes-par-zone' as a param
router.get('/commandes-par-zone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date =
      typeof req.query.date === 'string'
        ? req.query.date
        : new Date().toISOString().split('T')[0];

    const { rows } = await pool.query(
      `SELECT
         m.circuit,
         s.nom          AS structure_nom,
         c.creneau::text AS creneau,
         c.montant_total,
         mc.statut_livraison,
         c.statut        AS statut_commande,
         c.id            AS commande_id
       FROM missions m
       JOIN mission_commandes mc ON mc.mission_id = m.id
       JOIN commandes          c  ON c.id = mc.commande_id
       JOIN structures         s  ON s.id = c.structure_id
       WHERE m.date_mission = $1::date
       ORDER BY m.circuit, s.nom, c.creneau`,
      [date],
    );

    // Group by circuit
    const grouped: Record<string, {
      circuit: string;
      commandes: {
        structure_nom: string;
        creneau: string;
        montant_total: number;
        statut_commande: string;
        statut_livraison: string;
        commande_id: string;
      }[];
    }> = {};

    for (const row of rows) {
      const circuit: string = row.circuit;
      if (!grouped[circuit]) {
        grouped[circuit] = { circuit, commandes: [] };
      }
      grouped[circuit].commandes.push({
        structure_nom: row.structure_nom,
        creneau: row.creneau,
        montant_total: Number(row.montant_total),
        statut_commande: row.statut_commande,
        statut_livraison: row.statut_livraison,
        commande_id: row.commande_id,
      });
    }

    res.json(Object.values(grouped));
  } catch (err) {
    next(err);
  }
});

// Task 10.2 — GET /?date=YYYY-MM-DD → getMissionsToday(), grouped by livreur_id
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // getMissionsToday() filters by CURRENT_DATE; date param is accepted but
    // non-today date filtering is a display concern (service uses CURRENT_DATE)
    const missions = await LivreurService.getMissionsToday();

    // Group by livreur_id: { [livreur_id]: MissionWithCommandes[] }
    const grouped: Record<string, MissionWithCommandes[]> = {};
    for (const mission of missions) {
      const lid = mission.livreur_id;
      if (!grouped[lid]) grouped[lid] = [];
      grouped[lid].push(mission);
    }

    res.json(grouped);
  } catch (err) {
    next(err);
  }
});

// Task 10.3 — POST / with Zod validation → createMission()
const CreateMissionSchema = z.object({
  livreur_id: z.string().uuid(),
  date_mission: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu'),
  circuit: z.string().min(1, 'Le circuit est requis'),
  commande_ids: z.array(z.string().uuid()).min(1, 'Au moins une commande est requise'),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateMissionSchema.parse(req.body);
    const mission = await LivreurService.createMission(input);
    res.status(201).json(mission);
  } catch (err) {
    next(err);
  }
});

// Task 10.4 — PATCH /:id with Zod validation → updateMission()
const UpdateMissionSchema = z.object({
  circuit: z.string().min(1).optional(),
  date_mission: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu').optional(),
  commande_ids: z.array(z.string().uuid()).min(1).optional(),
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = UpdateMissionSchema.parse(req.body);
    const mission = await LivreurService.updateMission(req.params.id, input);
    res.json(mission);
  } catch (err) {
    next(err);
  }
});

// Task 10.5 — POST /:id/cancel → cancelMission()
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await LivreurService.cancelMission(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
