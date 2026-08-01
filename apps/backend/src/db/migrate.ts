import fs from 'fs';
import path from 'path';
import pool from './pool';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Créer la table de suivi des migrations si elle n'existe pas
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT id FROM migrations WHERE filename = $1',
        [file]
      );

      if (rows.length === 0) {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [file]
          );
          console.log(`Migration ${file} completed.`);
        } catch (err) {
          console.error(`Migration ${file} failed:`, err);
          throw err;
        }
      } else {
        console.log(`Migration ${file} already applied, skipping.`);
      }
    }

    console.log('All migrations up to date.');
  } catch (err) {
    console.error('runMigrations failed:', err);
    throw err;
  } finally {
    client.release();
  }
}
