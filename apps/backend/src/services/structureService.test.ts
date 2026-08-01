/**
 * Unit tests for StructureService
 * Tests the service logic using a mocked DB pool.
 */

// Mock the pool module before any imports that use it
jest.mock('../db/pool', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import pool from '../db/pool';
import StructureService from './structureService';
import { AppError } from '../utils/errors';
import bcrypt from 'bcrypt';

const mockPool = pool as jest.Mocked<typeof pool>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------
describe('StructureService.create()', () => {
  it('retourne la structure créée et le plainPassword en clair', async () => {
    const fakeRow = {
      id: 'uuid-1',
      nom: 'Acme Corp',
      domaine: 'tech',
      telephone: '+221771234567',
      latitude: 14.7167,
      longitude: -17.4677,
      login: 'acme-corp-ab12',
      actif: true,
      created_at: new Date(),
    };

    // ensureUniqueLogin → first SELECT returns no rows (login is free)
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })          // SELECT for uniqueness check
      .mockResolvedValueOnce({ rows: [fakeRow] });  // INSERT RETURNING

    const result = await StructureService.create({
      nom: 'Acme Corp',
      domaine: 'tech',
      telephone: '+221771234567',
      latitude: 14.7167,
      longitude: -17.4677,
    });

    expect(result.structure).toMatchObject({ nom: 'Acme Corp', login: 'acme-corp-ab12' });
    expect(typeof result.plainPassword).toBe('string');
    expect(result.plainPassword.length).toBeGreaterThanOrEqual(12);
  });

  it('ne retourne jamais le password_hash dans la structure renvoyée', async () => {
    const fakeRow = {
      id: 'uuid-2',
      nom: 'Beta SA',
      login: 'beta-sa-zz99',
      actif: true,
      created_at: new Date(),
    };

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [fakeRow] });

    const result = await StructureService.create({ nom: 'Beta SA', latitude: 0, longitude: 0 });
    expect(result.structure).not.toHaveProperty('password_hash');
  });

  it('génère un login sous la forme slug-suffixe', async () => {
    const fakeRow = { id: 'uuid-3', nom: 'Café Délice', login: 'cafe-delice-xxxx', actif: true, created_at: new Date() };

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [fakeRow] });

    const result = await StructureService.create({ nom: 'Café Délice', latitude: 0, longitude: 0 });
    // Le login injecté dans l'INSERT doit correspondre au format slug-suffixe
    const insertCall = (mockPool.query as jest.Mock).mock.calls[1];
    const loginArg: string = insertCall[1][5]; // 6ème paramètre de l'INSERT
    expect(loginArg).toMatch(/^[a-z0-9-]+-[a-z0-9]{4}$/);
  });

  it('retente un nouveau login si le premier est déjà pris', async () => {
    const fakeRow = { id: 'uuid-4', nom: 'Dup Co', login: 'dup-co-zzzz', actif: true, created_at: new Date() };

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }) // first login taken
      .mockResolvedValueOnce({ rows: [] })                    // second login free
      .mockResolvedValueOnce({ rows: [fakeRow] });            // INSERT

    const result = await StructureService.create({ nom: 'Dup Co', latitude: 0, longitude: 0 });
    expect(result.structure).toMatchObject({ nom: 'Dup Co' });
    // Should have been called 3 times: 2 uniqueness checks + 1 INSERT
    expect(mockPool.query).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// list()
// ---------------------------------------------------------------------------
describe('StructureService.list()', () => {
  it('retourne toutes les structures sans password_hash', async () => {
    const rows = [
      { id: 'a', nom: 'Alpha', login: 'alpha-1111', actif: true },
      { id: 'b', nom: 'Beta',  login: 'beta-2222',  actif: false },
    ];
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows });

    const result = await StructureService.list();
    expect(result).toHaveLength(2);
    expect(result[0]).not.toHaveProperty('password_hash');
  });
});

// ---------------------------------------------------------------------------
// getById()
// ---------------------------------------------------------------------------
describe('StructureService.getById()', () => {
  it('retourne la structure correspondante', async () => {
    const row = { id: 'uuid-5', nom: 'Gamma SARL', login: 'gamma-sarl-fg78', actif: true };
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [row] });

    const result = await StructureService.getById('uuid-5');
    expect(result).toMatchObject({ id: 'uuid-5', nom: 'Gamma SARL' });
  });

  it('lève AppError RESOURCE_NOT_FOUND si introuvable', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(StructureService.getById('inexistant')).rejects.toThrow(AppError);
    await expect(StructureService.getById('inexistant2'))
      .rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', statusCode: 404 });
  });
});

// ---------------------------------------------------------------------------
// update()
// ---------------------------------------------------------------------------
describe('StructureService.update()', () => {
  it('ne modifie pas le login lors d\'une mise à jour', async () => {
    const updatedRow = {
      id: 'uuid-6',
      nom: 'Nouveau Nom',
      domaine: 'finance',
      login: 'original-login-ab12', // login inchangé
      actif: true,
      created_at: new Date(),
    };
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [updatedRow] });

    const result = await StructureService.update('uuid-6', { nom: 'Nouveau Nom', domaine: 'finance' });

    expect(result).toMatchObject({ login: 'original-login-ab12' });

    // Vérifier que la requête UPDATE ne contient pas "login ="
    const updateCall = (mockPool.query as jest.Mock).mock.calls[0];
    const sql: string = updateCall[0];
    expect(sql).not.toMatch(/login\s*=/i);
  });

  it('lève AppError RESOURCE_NOT_FOUND si la structure n\'existe pas', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(StructureService.update('ghost-id', { nom: 'X' }))
      .rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', statusCode: 404 });
  });

  it('retourne la structure inchangée si aucun champ fourni', async () => {
    const row = { id: 'uuid-7', nom: 'Inchangé', login: 'inchange-ab12', actif: true };
    // When no fields: falls through to getById which does a SELECT
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [row] });

    const result = await StructureService.update('uuid-7', {});
    expect(result).toMatchObject({ nom: 'Inchangé' });
  });
});

// ---------------------------------------------------------------------------
// toggle()
// ---------------------------------------------------------------------------
describe('StructureService.toggle()', () => {
  it('inverse le statut actif de la structure', async () => {
    const row = { id: 'uuid-8', nom: 'Delta', actif: false }; // was true, now false
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [row] });

    const result = await StructureService.toggle('uuid-8');
    expect(result).toMatchObject({ actif: false });
  });

  it('lève AppError RESOURCE_NOT_FOUND si introuvable', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(StructureService.toggle('ghost'))
      .rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', statusCode: 404 });
  });
});

// ---------------------------------------------------------------------------
// resetPassword()
// ---------------------------------------------------------------------------
describe('StructureService.resetPassword()', () => {
  it('retourne { login, plainPassword } et invalide les sessions', async () => {
    const row = { id: 'uuid-9', login: 'target-login-zz99' };
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [row] })  // UPDATE password_hash
      .mockResolvedValueOnce({ rows: [] });    // DELETE sessions

    const result = await StructureService.resetPassword('uuid-9');

    expect(result).toHaveProperty('login', 'target-login-zz99');
    expect(result).toHaveProperty('plainPassword');
    expect(typeof result.plainPassword).toBe('string');
    expect(result.plainPassword.length).toBeGreaterThanOrEqual(12);
  });

  it('stocke un hash bcrypt valide (pas le mot de passe en clair)', async () => {
    const row = { id: 'uuid-10', login: 'check-hash-ab12' };
    let capturedHash = '';
    (mockPool.query as jest.Mock)
      .mockImplementationOnce((_sql: string, params: unknown[]) => {
        capturedHash = params[0] as string;
        return Promise.resolve({ rows: [row] });
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await StructureService.resetPassword('uuid-10');

    // Le hash stocké ne doit pas être le mot de passe en clair
    expect(capturedHash).not.toBe(result.plainPassword);
    // Doit être un hash bcrypt valide
    const isValidHash = await bcrypt.compare(result.plainPassword, capturedHash);
    expect(isValidHash).toBe(true);
  });

  it('supprime les sessions de la structure après reset', async () => {
    const row = { id: 'uuid-11', login: 'my-struct-cd34' };
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] });

    await StructureService.resetPassword('uuid-11');

    const deleteCall = (mockPool.query as jest.Mock).mock.calls[1];
    const deleteSql: string = deleteCall[0];
    expect(deleteSql).toMatch(/DELETE FROM sessions/i);
    expect(deleteCall[1]).toContain('uuid-11');
    expect(deleteCall[1]).toContain('structure');
  });

  it('lève AppError RESOURCE_NOT_FOUND si introuvable', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(StructureService.resetPassword('ghost'))
      .rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', statusCode: 404 });
  });

  it('ne retourne jamais le password_hash en clair', async () => {
    const row = { id: 'uuid-12', login: 'no-hash-ef56' };
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await StructureService.resetPassword('uuid-12');
    expect(result).not.toHaveProperty('password_hash');
  });
});
