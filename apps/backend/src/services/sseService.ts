import { Response } from 'express';

interface SSEClient {
  res: Response;
  entityId: string;
  role: 'structure' | 'admin';
}

// Registre global des clients connectés
const clients = new Map<string, SSEClient>();

function clientKey(entityId: string, role: string): string {
  return `${role}:${entityId}`;
}

export const SSEService = {
  /**
   * Enregistre un nouveau client SSE.
   * Envoie un ping initial pour confirmer la connexion.
   */
  addClient(res: Response, entityId: string, role: 'structure' | 'admin'): void {
    const key = clientKey(entityId, role);
    // Fermer la connexion précédente si elle existe
    const existing = clients.get(key);
    if (existing) {
      existing.res.end();
    }
    clients.set(key, { res, entityId, role });

    // Ping de connexion
    res.write(`event: connected\ndata: ${JSON.stringify({ entityId, role })}\n\n`);

    // Nettoyage à la déconnexion
    res.on('close', () => {
      SSEService.removeClient(entityId, role);
    });
  },

  removeClient(entityId: string, role: 'structure' | 'admin'): void {
    clients.delete(clientKey(entityId, role));
  },

  /**
   * Émet un événement SSE.
   * - Si target est un structureId → unicast vers cette structure
   * - Si target est 'admin' → broadcast à tous les admins
   * - Sans target → broadcast global
   */
  emit(event: string, data: unknown, target?: string): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    if (target === 'admin') {
      for (const client of clients.values()) {
        if (client.role === 'admin') {
          client.res.write(payload);
        }
      }
    } else if (target) {
      // Unicast structure
      const key = clientKey(target, 'structure');
      const client = clients.get(key);
      if (client) client.res.write(payload);
    } else {
      // Broadcast global
      for (const client of clients.values()) {
        client.res.write(payload);
      }
    }
  },

  /**
   * Retourne le nombre de clients connectés (utile pour les tests).
   */
  clientCount(): number {
    return clients.size;
  },
};

export default SSEService;
