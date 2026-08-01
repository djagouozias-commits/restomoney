import cron from 'node-cron';
import RotationService from '../services/rotationService';

/**
 * Cron job : rotation automatique à minuit (00h00) chaque jour.
 * Exécute la rotation pour la date du jour.
 *
 * Schedule: 0 0 * * *
 * Requirements: 11.1, 11.3, 11.4
 */
export function startRotationCron(): void {
  cron.schedule('0 0 * * *', async () => {
    const today = new Date();
    console.log(`[RotationCron] Démarrage rotation pour ${today.toISOString().split('T')[0]}`);

    try {
      const result = await RotationService.executerRotation(today);
      if (result.success) {
        console.log(`[RotationCron] ✓ Rotation réussie : ${result.message || 'OK'}`);
      }
    } catch (err) {
      console.error('[RotationCron] ✗ Échec rotation :', err);
    }
  }, {
    timezone: 'Africa/Dakar', // Timezone Dakar/Sénégal (UTC+0)
  });

  console.log('[RotationCron] Job planifié : 0 0 * * * (minuit chaque jour)');
}
