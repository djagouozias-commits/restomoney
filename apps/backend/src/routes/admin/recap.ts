import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import pool from '../../db/pool';

const router = Router();
router.use(authenticate, requireAdmin);

/**
 * GET /admin/recap?structureId=X&date=YYYY-MM-DD&creneau=HH:MM
 *
 * Retourne un récapitulatif imprimable :
 * Pour chaque plat/menu commandé à ce créneau dans cette structure,
 * la liste des employés (login) qui l'ont commandé.
 *
 * Format de réponse :
 * {
 *   structure: { nom, ... },
 *   creneau: "12:00",
 *   date: "2024-01-15",
 *   lignes: [
 *     { type: "plat", nom: "Riz gras", employes: ["boa1","boa3","boa5"] },
 *     { type: "menu", nom: "Menu Express", employes: ["boa2","boa4"],
 *       details: [{ employe: "boa2", options: ["Jus baobab"] }] }
 *   ]
 * }
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { structureId, date, creneau } = req.query as Record<string, string>;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Info structure
    const { rows: sRows } = await pool.query(
      'SELECT id, nom, domaine, telephone FROM structures WHERE id = $1',
      [structureId],
    );
    if (sRows.length === 0) {
      return res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Structure introuvable' } });
    }

    // Construire la requête selon les filtres
    let query = `
      SELECT
        c.id as commande_id,
        c.creneau::text,
        c.date_commande::text,
        COALESCE(e.login, s.login) as employe_login,
        lc.type,
        lc.quantite,
        lc.prix_unitaire,
        COALESCE(p.nom, m.nom) as article_nom,
        lc.plat_id,
        lc.menu_complet_id,
        lc.id as ligne_id
      FROM commandes c
      JOIN structures s ON s.id = c.structure_id
      LEFT JOIN employes e ON e.id = c.employe_id
      JOIN lignes_commande lc ON lc.commande_id = c.id
      LEFT JOIN plats p ON p.id = lc.plat_id
      LEFT JOIN menus_complets m ON m.id = lc.menu_complet_id
      WHERE c.structure_id = $1
        AND c.date_commande = $2::date`;

    const params: unknown[] = [structureId, targetDate];

    if (creneau) {
      query += ` AND c.creneau = $3::time`;
      params.push(`${creneau}:00`);
    }

    query += ' ORDER BY c.creneau, lc.type, article_nom, employe_login';

    const { rows } = await pool.query(query, params);

    // Récupérer les options sélectionnées pour les menus
    const ligneIds = rows.map((r: any) => r.ligne_id);
    let optionsMap: Record<string, string[]> = {};
    if (ligneIds.length > 0) {
      const { rows: optRows } = await pool.query(
        `SELECT so.ligne_commande_id, o.nom as option_nom, c2.nom as composant_nom
         FROM selections_options so
         JOIN options o ON o.id = so.option_id
         JOIN composants c2 ON c2.id = so.composant_id
         WHERE so.ligne_commande_id = ANY($1)`,
        [ligneIds],
      );
      for (const opt of optRows) {
        if (!optionsMap[opt.ligne_commande_id]) optionsMap[opt.ligne_commande_id] = [];
        optionsMap[opt.ligne_commande_id].push(`${opt.composant_nom}: ${opt.option_nom}`);
      }
    }

    // Grouper par créneau puis par article
    const creneauxMap: Record<string, Record<string, {
      type: string;
      nom: string;
      articleId: string;
      employes: Array<{ login: string; quantite: number; options: string[] }>;
    }>> = {};

    for (const row of rows) {
      const cr = row.creneau;
      if (!creneauxMap[cr]) creneauxMap[cr] = {};

      const key = row.plat_id || row.menu_complet_id;
      if (!creneauxMap[cr][key]) {
        creneauxMap[cr][key] = {
          type: row.type,
          nom: row.article_nom,
          articleId: key,
          employes: [],
        };
      }
      creneauxMap[cr][key].employes.push({
        login: row.employe_login,
        quantite: row.quantite,
        options: optionsMap[row.ligne_id] || [],
      });
    }

    // Construire la réponse finale
    const creneauxResult = Object.entries(creneauxMap).sort().map(([cr, articles]) => ({
      creneau: cr,
      lignes: Object.values(articles).sort((a, b) => a.nom.localeCompare(b.nom)),
    }));

    res.json({
      structure: sRows[0],
      date: targetDate,
      creneaux: creneauxResult,
    });
  } catch (err) { next(err); }
});

export default router;
