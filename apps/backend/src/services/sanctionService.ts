import pool from '../db/pool';
import { AppError } from '../utils/errors';
import { CommandeEnRetard } from './retardService';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ParametreSanction {
  niveau: number;           // 1–4
  min_minutes: number;
  max_minutes: number | null;
  reduction_pct: number;    // 0–100
  emettre_bon: boolean;
}

export interface ResultatSanction {
  commande_id: string;
  niveau: number | null;
  montant_final: number;
  bon_emis: boolean;
  bon_id?: string;
}

export interface HistoriqueSanction {
  id: string;
  commande_id: string;
  structure_id: string;
  minutes_retard: number;
  niveau: number | null;
  montant_final: number;
  applique_le: string;
}

export interface BonReduction {
  id: string;
  structure_id: string;
  valeur_pct: number;
  emis_le: string;
  expire_le: string;
  utilise: boolean;
  commande_id_source: string | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const SanctionService = {
  /**
   * Calcule le nombre de minutes de retard depuis l'heure courante
   * par rapport au créneau prévu (format 'HH:MM:SS').
   *
   * Requirements: 3.1
   */
  calculateMinutesRetard(creneau: string): number {
    const now = new Date();
    const [hours, minutes, seconds] = creneau.split(':').map(Number);
    const creneauMs =
      (hours * 3600 + minutes * 60 + (seconds ?? 0)) * 1000;
    const nowMs =
      (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) * 1000;
    const diffMs = nowMs - creneauMs;
    return Math.floor(diffMs / 60000);
  },

  /**
   * Retourne le niveau de sanction applicable selon les minutes de retard,
   * ou null si aucun niveau ne correspond (retard < 5 min ou non couvert).
   *
   * Requirements: 2.1, 2.2, 2.5
   */
  async findNiveau(minutesRetard: number): Promise<ParametreSanction | null> {
    if (minutesRetard < 5) return null;

    const { rows } = await pool.query<ParametreSanction>(
      `SELECT niveau, min_minutes, max_minutes, reduction_pct, emettre_bon
       FROM parametres_sanctions
       WHERE min_minutes <= $1
         AND (max_minutes IS NULL OR $1 < max_minutes)
       LIMIT 1`,
      [minutesRetard],
    );

    return rows[0] ?? null;
  },

  /**
   * Calcule le montant final après application du pourcentage de réduction.
   * Résultat arrondi à 2 décimales, jamais négatif.
   *
   * Requirements: 2.3, 2.4
   */
  calculerMontantFinal(montantTotal: number, reductionPct: number): number {
    const montant = montantTotal * (1 - reductionPct / 100);
    return Math.max(0, Math.round(montant * 100) / 100);
  },

  /**
   * Applique la sanction sur une commande individuelle (idempotent).
   * Ignore les commandes déjà sanctionnées (penalite = true).
   * Émet un bon de réduction si le niveau le requiert.
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   */
  async appliquerSanction(commande: CommandeEnRetard): Promise<ResultatSanction | null> {
    const minutesRetard = SanctionService.calculateMinutesRetard(commande.creneau);
    const niveau = await SanctionService.findNiveau(minutesRetard);

    if (!niveau) {
      if (minutesRetard >= 5) {
        console.warn(
          `[SanctionService] Aucun niveau trouvé pour commande ${commande.id} — ${minutesRetard} min de retard`,
        );
      }
      return null;
    }

    const montantFinal = SanctionService.calculerMontantFinal(
      commande.montant_total,
      niveau.reduction_pct,
    );

    // Mise à jour idempotente : n'écrase pas si penalite est déjà true
    const { rows: updatedRows } = await pool.query<{
      id: string;
      penalite: boolean;
      montant_final: number;
    }>(
      `UPDATE commandes
       SET penalite = true,
           montant_final = $1,
           statut_updated_at = NOW()
       WHERE id = $2
         AND penalite = false
       RETURNING id, penalite, montant_final`,
      [montantFinal, commande.id],
    );

    // Commande déjà sanctionnée — idempotence
    if (updatedRows.length === 0) {
      return null;
    }

    console.log(
      `[SanctionService] Sanction appliquée — commande: ${commande.id}, structure: ${commande.structure_id}, ` +
        `retard: ${minutesRetard} min, niveau: ${niveau.niveau}, montant_final: ${montantFinal}`,
    );

    // Insertion dans l'historique
    await pool.query(
      `INSERT INTO historique_sanctions (commande_id, structure_id, minutes_retard, niveau, montant_final)
       VALUES ($1, $2, $3, $4, $5)`,
      [commande.id, commande.structure_id, minutesRetard, niveau.niveau, montantFinal],
    );

    let bonId: string | undefined;

    if (niveau.emettre_bon) {
      const bon = await SanctionService.emettresBon(
        commande.structure_id,
        niveau.reduction_pct,
        commande.id,
      );
      bonId = bon.id;
    }

    return {
      commande_id: commande.id,
      niveau: niveau.niveau,
      montant_final: montantFinal,
      bon_emis: niveau.emettre_bon,
      bon_id: bonId,
    };
  },

  /**
   * Traite un lot de commandes en retard (appelé par le cron).
   * Isole les erreurs par commande pour ne pas bloquer le batch.
   *
   * Requirements: 3.1, 3.6
   */
  async appliquerSanctions(commandes: CommandeEnRetard[]): Promise<void> {
    for (const commande of commandes) {
      try {
        await SanctionService.appliquerSanction(commande);
      } catch (err) {
        console.error(
          `[SanctionService] Erreur lors du traitement de la commande ${commande.id}:`,
          err,
        );
      }
    }
  },

  /**
   * Émet un bon de réduction pour une structure avec une durée de validité de 30 jours.
   *
   * Requirements: 4.1, 4.2, 4.4
   */
  async emettresBon(
    structureId: string,
    valeurPct: number,
    commandeIdSource: string,
  ): Promise<BonReduction> {
    const { rows } = await pool.query<BonReduction>(
      `INSERT INTO bons_reduction (structure_id, valeur_pct, expire_le, commande_id_source)
       VALUES ($1, $2, NOW() + INTERVAL '30 days', $3)
       RETURNING id, structure_id, valeur_pct, emis_le::text, expire_le::text, utilise, commande_id_source::text`,
      [structureId, valeurPct, commandeIdSource],
    );

    const bon = rows[0];

    console.log(
      `[SanctionService] Bon émis — id: ${bon.id}, structure: ${bon.structure_id}, expire_le: ${bon.expire_le}`,
    );

    return bon;
  },

  /**
   * Retourne la liste des paramètres de sanction (niveaux 1–4).
   *
   * Requirements: 1.1, 5.1
   */
  async getParametres(): Promise<ParametreSanction[]> {
    const { rows } = await pool.query<ParametreSanction>(
      `SELECT niveau, min_minutes, max_minutes, reduction_pct, emettre_bon
       FROM parametres_sanctions
       ORDER BY niveau`,
    );
    return rows;
  },

  /**
   * Met à jour un paramètre de sanction existant.
   * Valide les contraintes métier avant la mise à jour.
   *
   * Requirements: 1.3, 1.4, 1.5
   */
  async updateParametre(
    niveau: number,
    patch: Partial<ParametreSanction>,
  ): Promise<ParametreSanction> {
    if (
      patch.reduction_pct !== undefined &&
      (patch.reduction_pct < 0 || patch.reduction_pct > 100)
    ) {
      throw new AppError('VALIDATION_ERROR', 'reduction_pct doit être compris entre 0 et 100', 422);
    }

    if (patch.min_minutes !== undefined && patch.min_minutes < 0) {
      throw new AppError('VALIDATION_ERROR', 'min_minutes ne peut pas être négatif', 422);
    }

    const { rows } = await pool.query<ParametreSanction>(
      `UPDATE parametres_sanctions
       SET min_minutes   = COALESCE($1, min_minutes),
           max_minutes   = COALESCE($2, max_minutes),
           reduction_pct = COALESCE($3, reduction_pct),
           emettre_bon   = COALESCE($4, emettre_bon)
       WHERE niveau = $5
       RETURNING niveau, min_minutes, max_minutes, reduction_pct, emettre_bon`,
      [
        patch.min_minutes ?? null,
        patch.max_minutes ?? null,
        patch.reduction_pct ?? null,
        patch.emettre_bon ?? null,
        niveau,
      ],
    );

    if (rows.length === 0) {
      throw new AppError('RESOURCE_NOT_FOUND', `Niveau de sanction ${niveau} introuvable`, 404);
    }

    return rows[0];
  },

  /**
   * Retourne l'historique des sanctions, filtrable par date et/ou structure.
   *
   * Requirements: 6.3
   */
  async getHistorique(filters: {
    date?: string;
    structure_id?: string;
  }): Promise<HistoriqueSanction[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.date) {
      conditions.push(`DATE(applique_le) = $${idx++}`);
      params.push(filters.date);
    }

    if (filters.structure_id) {
      conditions.push(`structure_id = $${idx++}`);
      params.push(filters.structure_id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query<HistoriqueSanction>(
      `SELECT id, commande_id::text, structure_id::text, minutes_retard, niveau,
              montant_final, applique_le::text
       FROM historique_sanctions
       ${where}
       ORDER BY applique_le DESC`,
      params,
    );

    return rows;
  },

  /**
   * Retourne la liste des bons de réduction, filtrable par structure et/ou date.
   *
   * Requirements: 5.5
   */
  async getBons(filters: {
    structure_id?: string;
    date?: string;
  }): Promise<BonReduction[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.structure_id) {
      conditions.push(`structure_id = $${idx++}`);
      params.push(filters.structure_id);
    }

    if (filters.date) {
      conditions.push(`DATE(emis_le) = $${idx++}`);
      params.push(filters.date);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query<BonReduction>(
      `SELECT id::text, structure_id::text, valeur_pct,
              emis_le::text, expire_le::text, utilise,
              commande_id_source::text
       FROM bons_reduction
       ${where}
       ORDER BY emis_le DESC`,
      params,
    );

    return rows;
  },
};

export default SanctionService;
