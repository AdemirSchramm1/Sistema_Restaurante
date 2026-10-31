import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { Pool } from "pg";

export const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, "migrations");

export async function runMigrations(url: string): Promise<void> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_MIGRATION_URL;
  if (!url) throw new Error("Defina DATABASE_MIGRATION_URL");
  await runMigrations(url);
  console.log("Migrações aplicadas.");
}
