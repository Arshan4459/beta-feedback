// Standalone migration runner: `npm run db:migrate`.
// Applies ./drizzle/*.sql via Drizzle's journal-tracked migrator (idempotent),
// against Postgres (DATABASE_URL) or local PGlite. Self-contained so it runs
// directly under `node` type-stripping (no local .ts imports).

const MIGRATIONS = "./drizzle";
const PGLITE_DIR = process.env.PGLITE_DIR ?? "./.pglite";

async function main() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: url,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    });
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });
    await pool.end();
    console.log("✓ migrated Postgres");
  } else {
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const { PGlite } = await import("@electric-sql/pglite");
    const client = new PGlite(PGLITE_DIR);
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS });
    await client.close();
    console.log(`✓ migrated PGlite (${PGLITE_DIR})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
