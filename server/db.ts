import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { resolveDatabaseUrl } from './database-url';

const resolvedDb = resolveDatabaseUrl(process.env.DATABASE_URL);

if (resolvedDb.usedHostFallback) {
  console.warn("DATABASE_URL host 'db' detected outside Docker. Using localhost fallback for PostgreSQL.");
}

export const pool = new Pool({ connectionString: resolvedDb.url });
export const db = drizzle(pool, { schema });
