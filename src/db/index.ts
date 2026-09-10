import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

// Function to create or retrieve the connection pool using the Object Method.
export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
export const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });

export const isDatabaseConfigured = (): boolean => {
  return Boolean(process.env.SQL_HOST && process.env.SQL_DB_NAME && process.env.SQL_USER);
};

export const getDatabaseUrl = (): string | undefined => {
  return undefined;
};

export async function testDatabaseConnection(): Promise<{ ok: boolean; host?: string; error?: string }> {
  if (!isDatabaseConfigured()) {
    return { ok: false, error: 'Variáveis de ambiente Cloud SQL (SQL_HOST, SQL_DB_NAME, SQL_USER) não configuradas.' };
  }
  try {
    const res = await pool.query('SELECT 1 as ping');
    return { ok: Boolean(res && res.rows && res.rows.length > 0), host: process.env.SQL_HOST };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function ensureTablesExist(): Promise<void> {
  // Schema is managed and synced via Drizzle Kit UpdateSchema
}
