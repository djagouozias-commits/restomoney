import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import jwt from 'jsonwebtoken';

import { runMigrations } from './db/migrate';
import { seedAdmin } from './db/seed';
import { errorHandler } from './middleware/errorHandler';
import { startRotationCron } from './cron/rotationCron';
import { startRetardCron } from './cron/retardCron';
import GpsService from './services/gpsService';

// Routes
import authRouter from './routes/auth';
import structuresRouter from './routes/admin/structures';
import employesRouter, { employeActionsRouter } from './routes/admin/employes';
import platsRouter from './routes/admin/plats';
import planningRouter from './routes/admin/planning';
import adminMenusRouter from './routes/admin/menus';
import adminCommandesRouter from './routes/admin/commandes';
import tourneesRouter from './routes/admin/tournees';
import rotationLogsRouter from './routes/admin/rotationLogs';
import recapRouter from './routes/admin/recap';
import sanctionsRouter from './routes/admin/sanctions';
import adminLivreursRouter from './routes/admin/livreurs';
import adminMissionsRouter from './routes/admin/missions';
import adminSignalementsRouter from './routes/admin/signalements';
import adminMembresRouter from './routes/admin/membres';
import adminWalletsRouter from './routes/admin/wallets';
import walletRouter from './routes/wallet';
import livreurRouter from './routes/livreur';
import commandesRouter from './routes/commandes';
import creneauxRouter from './routes/creneaux';
import menusRouter from './routes/menus';
import eventsRouter from './routes/events';
import signalementsRouter from './routes/signalements';
import membresRouter from './routes/membres';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

// ── Socket.IO server ─────────────────────────────────────────────────────────
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(o => o.trim());
      if (allowed.some((a) => origin === a || origin.endsWith('.vercel.app'))) {
        return callback(null, true);
      }
      callback(new Error('CORS socket not allowed'));
    },
    credentials: true,
  },
});

// JWT auth middleware for Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error('AUTH_MISSING_TOKEN'));
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { entityId: string; role: string };
    (socket as any).userId = payload.entityId;
    (socket as any).role = payload.role;
    next();
  } catch {
    next(new Error('AUTH_INVALID_TOKEN'));
  }
});

io.on('connection', (socket) => {
  const role = (socket as any).role as string;
  const userId = (socket as any).userId as string;

  // Admin joins the admin room to receive live GPS updates
  if (role === 'admin') {
    socket.join('admin');
    console.log(`[GPS] Admin connected: ${socket.id}`);
  }

  // Livreur sends position updates
  if (role === 'livreur') {
    console.log(`[GPS] Livreur ${userId} connected`);

    socket.on('gps:position', async (data: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      heading?: number;
      speed?: number;
      mission_id?: string;
    }) => {
      if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return;

      const pos = {
        livreur_id: userId,
        mission_id: data.mission_id ?? null,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy ?? null,
        heading: data.heading ?? null,
        speed: data.speed ?? null,
      };

      // Persist to DB (non-blocking)
      GpsService.savePosition(pos).catch((err) =>
        console.error('[GPS] savePosition error:', err),
      );

      // Broadcast to all admins in real time
      io.to('admin').emit('gps:update', {
        ...pos,
        livreur_id: userId,
        timestamp: new Date().toISOString(),
      });
    });
  }

  socket.on('disconnect', () => {
    if (role === 'livreur') {
      // Notify admins that livreur went offline
      io.to('admin').emit('gps:offline', { livreur_id: userId });
      console.log(`[GPS] Livreur ${userId} disconnected`);
    }
  });
});

// ── Middlewares globaux ──────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (ex: mobile, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some((allowed) => origin === allowed || origin.endsWith('.vercel.app'))) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Fichiers statiques ───────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes API v1 ────────────────────────────────────────────────────────────
const API = '/api/v1';

// Auth
app.use(`${API}/auth`, authRouter);

// Admin
app.use(`${API}/admin/structures`, structuresRouter);
app.use(`${API}/admin/structures`, employesRouter);
app.use(`${API}/admin/employes`, employeActionsRouter);
app.use(`${API}/admin/plats`, platsRouter);
app.use(`${API}/admin/planning`, planningRouter);
app.use(`${API}/admin/menus`, adminMenusRouter);
app.use(`${API}/admin/commandes`, adminCommandesRouter);
app.use(`${API}/admin/tournees`, tourneesRouter);
app.use(`${API}/admin/rotation-logs`, rotationLogsRouter);
app.use(`${API}/admin/recap`, recapRouter);
app.use(`${API}/admin/sanctions`, sanctionsRouter);
app.use(`${API}/admin/livreurs`, adminLivreursRouter);
app.use(`${API}/admin/missions`, adminMissionsRouter);
app.use(`${API}/admin/signalements`, adminSignalementsRouter);
app.use(`${API}/admin/structures`, adminMembresRouter);
app.use(`${API}/admin/wallets`, adminWalletsRouter);
app.use(`${API}/wallet`, walletRouter);
app.use(`${API}/livreur`, livreurRouter);

// Employee-facing
app.use(`${API}/commandes`, commandesRouter);
app.use(`${API}/creneaux`, creneauxRouter);
app.use(`${API}/menus`, menusRouter);
app.use(`${API}/events`, eventsRouter);
app.use(`${API}/signalements`, signalementsRouter);
app.use(`${API}/membres`, membresRouter);

// Alias : /plats-du-jour → creneaux router gère cette route
app.use(`${API}/plats-du-jour`, creneauxRouter);

// ── GPS REST endpoint (snapshot dernières positions) ─────────────────────────
import { authenticate, requireAdmin } from './middleware/auth';
app.get(`${API}/admin/gps/positions`, authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const positions = await GpsService.getLastPositions();
    res.json(positions);
  } catch (err) { next(err); }
});

app.get(`${API}/admin/gps/track/:missionId`, authenticate, requireAdmin, async (req, res, next) => {
  try {
    const track = await GpsService.getMissionTrack(req.params.missionId);
    res.json(track);
  } catch (err) { next(err); }
});

// ── Gestionnaire d'erreurs (doit être en dernier) ────────────────────────────
app.use(errorHandler);

// ── Démarrage ────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    await runMigrations();
    await seedAdmin();
    startRotationCron();
    startRetardCron();
    httpServer.listen(PORT, () => {
      console.log(`🚀 Backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export default app;
