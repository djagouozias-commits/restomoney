declare namespace Express {
  interface Request {
    userId?: string;
    role?: 'structure' | 'admin' | 'employe' | 'livreur';
    structureId?: string;
    employeId?: string;
    livreurId?: string;
  }
}
