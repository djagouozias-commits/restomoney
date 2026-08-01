import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import SSEService from '../services/sseService';

const router = Router();

// GET /events — Server-Sent Events
router.get('/', authenticate, (req: Request, res: Response, _next: NextFunction) => {
  // Headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Désactiver le buffering nginx
  res.flushHeaders();

  const entityId = req.userId!;
  const role = req.role as 'structure' | 'admin';

  // Enregistrer le client
  SSEService.addClient(res, entityId, role);

  // Keepalive toutes les 30 secondes
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  // Nettoyage à la déconnexion
  req.on('close', () => {
    clearInterval(keepAlive);
    SSEService.removeClient(entityId, role);
  });
});

export default router;
