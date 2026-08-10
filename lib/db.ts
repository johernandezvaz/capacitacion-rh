import { Pool, QueryResultRow, types } from 'pg';

types.setTypeParser(1082, (val) => val);
types.setTypeParser(1114, (val) => val);
types.setTypeParser(1184, (val) => val);

const globalForDb = globalThis as unknown as {
  dbPool: Pool | undefined;
};

function getConnectionString(): string {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error('[db] DATABASE_URL is not configured');
  }

  try {
    return decodeURIComponent(rawUrl);
  } catch {
    return rawUrl;
  }
}

export const pool =
  globalForDb.dbPool ??
  new Pool({
    connectionString: getConnectionString(),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.dbPool = pool;
}

export async function query<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
) {
  return pool.query<R>(text, params);
}