import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// Las columnas DATE se devuelven como texto 'AAAA-MM-DD' (sin convertir a hora UTC),
// así cumpleaños y turnos no se corren de día.
pg.types.setTypeParser(1082, (value) => value);

let pool;

export function getPool() {
  if (!pool) {
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL is required');
    }
    const local =
      config.databaseUrl.includes('localhost') ||
      config.databaseUrl.includes('127.0.0.1') ||
      config.databaseUrl.includes('railway.internal');
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      ssl: local ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  } finally {
    client.release();
  }
}
