import bcrypt from 'bcrypt';
import pool from './pool';

/**
 * Crée le compte Super Admin au démarrage si la table admins est vide.
 * Les credentials sont lus depuis les variables d'environnement.
 */
export async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL || 'admin@resto-money.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';

  const { rows } = await pool.query('SELECT id FROM admins WHERE email = $1', [email]);
  if (rows.length > 0) {
    console.log(`[Seed] Admin déjà existant : ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    'INSERT INTO admins (email, password_hash) VALUES ($1, $2)',
    [email, passwordHash],
  );

  console.log(`[Seed] ✓ Admin créé : ${email} / ${password}`);
}
