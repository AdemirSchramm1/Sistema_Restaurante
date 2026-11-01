import { runMigrations } from "../src/infra/db/migrate";

const url = process.env.DATABASE_MIGRATION_URL;
if (!url) throw new Error("Defina DATABASE_MIGRATION_URL");
await runMigrations(url);
console.log("Migrações aplicadas.");
