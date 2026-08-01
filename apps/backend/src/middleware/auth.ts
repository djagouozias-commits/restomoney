import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

interface JwtPayload {
  entityId: string;
  role: 'structure' | 'admin' | 'employe' | 'livreur';
  structureId?: string; // présent pour le rôle 'employe'
  iat: number;
  exp: number;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('AUTH_SESSION_EXPIRED', 'Token manquant ou format invalide', 401));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.userId = payload.entityId;
    req.role = payload.role as any;

    if (payload.role === 'structure') {
      // Pour une structure, structureId = entityId (toujours)
      req.structureId = payload.entityId;
    } else if (payload.role === 'employe') {
      // Employé : structureId dans le payload JWT (mis par generateTokenPair)
      req.structureId = payload.structureId || undefined;
      req.employeId = payload.entityId;
    } else if (payload.role === 'livreur') {
      req.livreurId = payload.entityId;
    }

    next();
  } catch (err) {
    next(new AppError('AUTH_SESSION_EXPIRED', 'Token expiré ou invalide', 401));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.role !== 'admin') {
    return next(new AppError('AUTH_FORBIDDEN', "Accès réservé à l'administrateur", 403));
  }
  next();
}

export function requireLivreur(req: Request, _res: Response, next: NextFunction): void {
  if (req.role !== 'livreur') {
    return next(new AppError('AUTH_FORBIDDEN', 'Accès réservé aux livreurs', 403));
  }
  next();
}

export function livreurScope(req: Request, _res: Response, next: NextFunction): void {
  const livreurId =
    (req.params && req.params.livreur_id) ||
    (req.body && req.body.livreur_id);

  if (livreurId && livreurId !== req.userId) {
    return next(new AppError('AUTH_FORBIDDEN', 'Accès interdit', 403));
  }
  next();
}

export function structureScope(req: Request, _res: Response, next: NextFunction): void {
  // Accepter structures et employés
  const isEmployee = req.role === 'employe' && req.structureId;
  const isStructure = req.role === 'structure';  // structureId est toujours = entityId pour structure

  if (!isEmployee && !isStructure) {
    return next(new AppError('AUTH_FORBIDDEN', 'Accès réservé aux structures/employés', 403));
  }

  // Garantir que structureId est défini pour une structure
  if (isStructure && !req.structureId) {
    req.structureId = req.userId;
  }

  const requestedStructureId =
    req.params?.structureId ||
    (typeof req.query?.structureId === 'string' ? req.query.structureId : undefined) ||
    (req.body && typeof req.body?.structureId === 'string' ? req.body.structureId : undefined);

  if (requestedStructureId && requestedStructureId !== req.structureId) {
    return next(new AppError('AUTH_FORBIDDEN', "Accès refusé : données d'une autre structure", 403));
  }

  next();
}
