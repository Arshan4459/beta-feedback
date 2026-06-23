// Database client. Picks a driver at runtime:
//   - DATABASE_URL set  -> real Postgres (node-postgres) for production
//   - otherwise         -> in-process PGlite persisted to ./.pglite (local dev)
// The cached promise makes this a singleton across warm serverless invocations.

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export const PGLITE_DIR = process.env.PGLITE_DIR ?? "./.pglite";

// Both drivers expose the same Drizzle query API; we type against one so the
// query builder (e.g. onConflictDoNothing) resolves to a single signature.
type DB = NodePgDatabase<typeof schema>;

let dbPromise: Promise<DB> | null = null;

async function init(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.DB_POOL_MAX ?? "5"),
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    });
    return drizzle(pool, { schema });
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(PGLITE_DIR);
  return drizzle(client, { schema }) as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!dbPromise) dbPromise = init();
  return dbPromise;
}

export { schema };
