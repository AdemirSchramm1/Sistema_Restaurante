import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infra/db/schema/index.ts",
  out: "./src/infra/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_MIGRATION_URL ?? "postgres://postgres:postgres@localhost:5432/restaurante",
  },
});
