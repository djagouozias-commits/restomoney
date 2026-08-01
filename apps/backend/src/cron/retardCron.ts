import cron from 'node-cron';
import RetardService from '../services/retardService';
import SanctionService from '../services/sanctionService';
import SSEService from '../services/sseService';

/**
 * Cron job : détection des retards toutes les minutes.
 * Pour chaque commande dépassant sa fenêtre de tolérance (+10 min),
 * passe le statut à 'en_retard' et émet un événement SSE vers les admins.
 *
 * Schedule: * * * * *
 * Requirements: 9.1, 9.2
 */
export function startRetardCron(): void {
  cron.schedule('* * * * *', async () => {
    try {
      const retards = await RetardService.detecterRetards();

      if (retards.length > 0) {
        console.log(`[RetardCron] ${retards.length} commande(s) passée(s) en retard`);

        // Appliquer les sanctions avant de notifier les clients
        await SanctionService.appliquerSanctions(retards);

        // Émettre un événement SSE pour chaque commande en retard
        for (const commande of retards) {
          // Notifier l'admin
          SSEService.emit('commande_retard', commande, 'admin');
          // Notifier la structure concernée
          SSEService.emit('commande_retard', commande, commande.structure_id);
        }
      }
    } catch (err) {
      console.error('[RetardCron] Erreur détection retards :', err);
    }
  });

  console.log('[RetardCron] Job planifié : * * * * * (toutes les minutes)');
}
