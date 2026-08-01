import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, requireAdmin, structureScope } from './auth';
import { AppError } from '../utils/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

// Mock Express request, response, next
const mockResponse = () => {
  const res = {} as Response;
  return res;
};

const mockNext = (): NextFunction => jest.fn();

describe('Middleware: authenticate', () => {
  it('should inject userId, role, and structureId for a valid structure JWT', () => {
    const payload = { entityId: 'struct-123', role: 'structure' as const };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });

    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as Partial<Request> as Request;

    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticate(req, res, next);

    expect(req.userId).toBe('struct-123');
    expect(req.role).toBe('structure');
    expect(req.structureId).toBe('struct-123');
    expect(next).toHaveBeenCalledWith();
  });

  it('should inject userId and role for a valid admin JWT (no structureId)', () => {
    const payload = { entityId: 'admin-456', role: 'admin' as const };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });

    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as Partial<Request> as Request;

    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticate(req, res, next);

    expect(req.userId).toBe('admin-456');
    expect(req.role).toBe('admin');
    expect(req.structureId).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('should reject request with missing Authorization header', () => {
    const req = { headers: {} } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_SESSION_EXPIRED',
        statusCode: 401,
      }),
    );
  });

  it('should reject request with invalid Authorization format', () => {
    const req = {
      headers: { authorization: 'InvalidFormat token' },
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_SESSION_EXPIRED',
        statusCode: 401,
      }),
    );
  });

  it('should reject expired JWT token', () => {
    const payload = { entityId: 'struct-123', role: 'structure' as const };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' }); // Already expired

    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_SESSION_EXPIRED',
        statusCode: 401,
      }),
    );
  });

  it('should reject JWT with invalid signature', () => {
    const token = jwt.sign({ entityId: 'struct-123', role: 'structure' }, 'wrong-secret', {
      expiresIn: '15m',
    });

    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_SESSION_EXPIRED',
        statusCode: 401,
      }),
    );
  });
});

describe('Middleware: requireAdmin', () => {
  it('should allow request when role is admin', () => {
    const req = {
      userId: 'admin-123',
      role: 'admin' as const,
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should reject request when role is structure', () => {
    const req = {
      userId: 'struct-123',
      role: 'structure' as const,
      structureId: 'struct-123',
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_FORBIDDEN',
        statusCode: 403,
      }),
    );
  });

  it('should reject request when role is undefined', () => {
    const req = { userId: 'user-123' } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_FORBIDDEN',
        statusCode: 403,
      }),
    );
  });
});

describe('Middleware: structureScope', () => {
  it('should allow request when role is structure and structureId is set', () => {
    const req = {
      userId: 'struct-123',
      role: 'structure' as const,
      structureId: 'struct-123',
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    structureScope(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should reject request when role is admin', () => {
    const req = {
      userId: 'admin-123',
      role: 'admin' as const,
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    structureScope(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_FORBIDDEN',
        statusCode: 403,
      }),
    );
  });

  it('should reject request when role is structure but structureId is missing', () => {
    const req = {
      userId: 'struct-123',
      role: 'structure' as const,
      // structureId missing
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    structureScope(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_FORBIDDEN',
        statusCode: 403,
      }),
    );
  });

  it('should allow request when req.params.structureId matches req.structureId', () => {
    const req = {
      userId: 'struct-123',
      role: 'structure' as const,
      structureId: 'struct-123',
      params: { structureId: 'struct-123' },
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    structureScope(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should reject request when req.params.structureId does not match req.structureId', () => {
    const req = {
      userId: 'struct-123',
      role: 'structure' as const,
      structureId: 'struct-123',
      params: { structureId: 'struct-456' }, // Different!
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    structureScope(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_FORBIDDEN',
        message: "Accès refusé : données d'une autre structure",
        statusCode: 403,
      }),
    );
  });

  it('should allow request when req.query.structureId matches req.structureId', () => {
    const req = {
      userId: 'struct-123',
      role: 'structure' as const,
      structureId: 'struct-123',
      query: { structureId: 'struct-123' },
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    structureScope(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should reject request when req.query.structureId does not match req.structureId', () => {
    const req = {
      userId: 'struct-123',
      role: 'structure' as const,
      structureId: 'struct-123',
      query: { structureId: 'struct-789' }, // Different!
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    structureScope(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_FORBIDDEN',
        message: "Accès refusé : données d'une autre structure",
        statusCode: 403,
      }),
    );
  });

  it('should allow request when req.body.structureId matches req.structureId', () => {
    const req = {
      userId: 'struct-123',
      role: 'structure' as const,
      structureId: 'struct-123',
      body: { structureId: 'struct-123' },
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    structureScope(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should reject request when req.body.structureId does not match req.structureId', () => {
    const req = {
      userId: 'struct-123',
      role: 'structure' as const,
      structureId: 'struct-123',
      body: { structureId: 'struct-999' }, // Different!
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    structureScope(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_FORBIDDEN',
        message: "Accès refusé : données d'une autre structure",
        statusCode: 403,
      }),
    );
  });

  it('should allow request when no structureId is present in params/query/body', () => {
    const req = {
      userId: 'struct-123',
      role: 'structure' as const,
      structureId: 'struct-123',
      params: {},
      query: {},
      body: {},
    } as Partial<Request> as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    structureScope(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
