import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import AuthService from '../services/authService';

const router = Router();

const LoginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

const AdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const UnifiedLoginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

// POST /auth/login — Connexion Structure
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { login, password } = LoginSchema.parse(req.body);
    const tokens = await AuthService.loginStructure(login, password);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    });

    res.json({
      accessToken: tokens.accessToken,
      structureId: tokens.entityId,
      role: tokens.role,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/admin/login — Connexion Admin
router.post('/admin/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = AdminLoginSchema.parse(req.body);
    const tokens = await AuthService.loginAdmin(email, password);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: tokens.accessToken,
      adminId: tokens.entityId,
      role: tokens.role,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh — Renouvellement du token
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: { code: 'AUTH_SESSION_EXPIRED', message: 'Session expirée' } });
    }

    const tokens = await AuthService.refreshToken(refreshToken);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: tokens.accessToken,
      role: tokens.role,
      entityId: tokens.entityId,
      structureId: tokens.structureId,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/unified-login — Connexion unifiée (admin, structure/employé ou livreur)
router.post('/unified-login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identifier, password } = UnifiedLoginSchema.parse(req.body);

    let tokens;

    // Essayer d'abord en tant qu'admin (l'admin utilise un email)
    try {
      tokens = await AuthService.loginAdmin(identifier, password);
    } catch {
      // Si échec, essayer en tant que structure/employé
      try {
        tokens = await AuthService.loginStructure(identifier, password);
      } catch {
        // Si échec, essayer en tant que livreur
        tokens = await AuthService.loginLivreur(identifier, password);
      }
    }

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const responseBody: {
      accessToken: string;
      role: string;
      entityId: string;
      redirectTo?: string;
    } = {
      accessToken: tokens.accessToken,
      role: tokens.role,
      entityId: tokens.entityId,
    };

    if (tokens.role === 'admin') {
      responseBody.redirectTo = '/admin';
    } else if (tokens.role === 'livreur') {
      responseBody.redirectTo = '/livreur/dashboard';
    }

    res.json(responseBody);
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout — Déconnexion
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.userId) {
      await AuthService.logout(req.userId, req.role || 'structure');
    }
    res.clearCookie('refreshToken');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
