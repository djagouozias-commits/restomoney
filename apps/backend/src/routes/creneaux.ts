import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import pool from '../db/pool';

const router = Router();

router.use(authenticate);

const CRENEAUX = [
  { label: '09h00', time: '09:00' },
  { label: '12h00', time: '12:00' },
  { label: '16h00', time: '16:00' },
  { label: '20h00', time: '20:00' },
];

/**
 * Retourne true si le créneau est disponible pour aujourd'hui :
 * heure courante < heure créneau - 60 min
 */
function isCreneauDisponibleAujourdhui(creneauTime: string): boolean {
  const now = new Date();
  const [h, m] = creneauTime.split(':').map(Number);
  const creneau = new Date(now);
  creneau.setHours(h, m, 0, 0);
  return (creneau.getTime() - now.getTime()) / 60000 >= 60;
}

/**
 * Après 20h (plus aucun créneau dispo aujourd'hui), on passe en mode
 * "commande pour le lendemain" : tous les créneaux sont disponibles.
 */
function buildCreneaux() {
  const now = new Date();
  const anyAvailableToday = CRENEAUX.some((c) => isCreneauDisponibleAujourdhui(c.time));

  if (anyAvailableToday) {
    // Mode normal : créneaux du jour
    return CRENEAUX.map((c) => ({
      ...c,
      disponible: isCreneauDisponibleAujourdhui(c.time),
      lendemain: false,
    }));
  } else {
    // Mode lendemain : tous les créneaux disponibles pour le jour suivant
    return CRENEAUX.map((c) => ({
      ...c,
      disponible: true,
      lendemain: true,
    }));
  }
}

// GET /creneaux — les 4 créneaux avec leur disponibilité
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(buildCreneaux());
  } catch (err) { next(err); }
});

// GET /plats-du-jour — résout les plats du jour via PlanningService (surcharge > planning hebdo)
router.get('/plats-du-jour', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Utiliser PlanningService.resolvePlatsDuJour() pour respecter surcharges + planning hebdo
    const { PlanningService } = await import('../services/planningService');
    const platsBase = await PlanningService.resolvePlatsDuJour(new Date());

    if (platsBase.length === 0) {
      return res.json([]);
    }

    // 2. Enrichir avec les variantes
    const platIds = platsBase.map((r: any) => r.id);
    const { rows: variantes } = await pool.query(
      `SELECT id::text, plat_id::text, libelle, prix::float, position
       FROM plat_variantes
       WHERE plat_id = ANY($1)
       ORDER BY plat_id, position ASC`,
      [platIds],
    );

    const varMap = new Map<string, any[]>();
    for (const v of variantes) {
      const list = varMap.get(v.plat_id) ?? [];
      list.push(v);
      varMap.set(v.plat_id, list);
    }

    // 3. Ajouter avec_jetable depuis la table plats
    const { rows: platDetails } = await pool.query(
      `SELECT id, avec_jetable FROM plats WHERE id = ANY($1)`,
      [platIds],
    );
    const jetableMap = new Map(platDetails.map((p: any) => [String(p.id), p.avec_jetable]));

    const result = platsBase.map((r: any) => ({
      ...r,
      avec_jetable: jetableMap.get(String(r.id)) ?? false,
      variantes: varMap.get(String(r.id)) ?? [],
    }));

    res.json(result);
  } catch (err) { next(err); }
});

export default router;
