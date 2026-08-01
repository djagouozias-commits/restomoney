import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import pool from '../../db/pool';
import PenaliteService from '../../services/penaliteService';

const router = Router();

router.use(authenticate, requireAdmin);

// GET /admin/commandes — liste avec filtres optionnels
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { structure_id, creneau, date } = req.query;
    let query = `
      SELECT c.id, c.structure_id, s.nom as structure_nom,
             c.creneau::text, c.date_commande::text, c.statut,
             c.penalite, c.montant_total, c.montant_final, c.created_at
      FROM commandes c
      JOIN structures s ON s.id = c.structure_id
      WHERE 1=1`;
    const params: unknown[] = [];
    let idx = 1;

    if (structure_id) { query += ` AND c.structure_id = $${idx++}`; params.push(structure_id); }
    if (creneau) { query += ` AND c.creneau = $${idx++}::time`; params.push(`${creneau}:00`); }
    if (date) { query += ` AND c.date_commande = $${idx++}::date`; params.push(date); }

    query += ' ORDER BY c.created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /admin/commandes/aggregate — volume agrégé par plat/menu par créneau
router.get('/aggregate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date } = req.query;
    const dateFilter = date || new Date().toISOString().split('T')[0];

    const { rows } = await pool.query(
      `SELECT
         c.creneau::text,
         lc.type,
         lc.plat_id,
         lc.menu_complet_id,
         COALESCE(p.nom, m.nom) as nom,
         SUM(lc.quantite)::int as quantite_totale
       FROM lignes_commande lc
       JOIN commandes c ON c.id = lc.commande_id
       LEFT JOIN plats p ON p.id = lc.plat_id
       LEFT JOIN menus_complets m ON m.id = lc.menu_complet_id
       WHERE c.date_commande = $1::date
       GROUP BY c.creneau, lc.type, lc.plat_id, lc.menu_complet_id, COALESCE(p.nom, m.nom)
       ORDER BY c.creneau, nom`,
      [dateFilter],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// PATCH /admin/commandes/:id/statut
const StatutSchema = z.object({
  statut: z.enum(['en_attente', 'en_preparation', 'en_livraison', 'livre', 'en_retard']),
});

router.patch('/:id/statut', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { statut } = StatutSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE commandes
       SET statut = $1, statut_updated_at = NOW()
       WHERE id = $2
       RETURNING id, statut, statut_updated_at`,
      [statut, req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Commande introuvable' } });
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /admin/commandes/:id/penalite
router.post('/:id/penalite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const commande = await PenaliteService.appliquerPenalite(req.params.id);
    res.json(commande);
  } catch (err) { next(err); }
});

// GET /admin/retards
router.get('/retards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.structure_id, s.nom as structure_nom,
              c.creneau::text, c.date_commande::text,
              c.penalite, c.montant_total, c.montant_final, c.statut_updated_at
       FROM commandes c
       JOIN structures s ON s.id = c.structure_id
       WHERE c.statut = 'en_retard'
       ORDER BY c.date_commande DESC, c.creneau`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
