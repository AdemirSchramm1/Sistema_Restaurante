import { Client } from "pg";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../../src/infra/db/migrate";

const DB_NAME = "restaurante_test";
const APP_LOGIN = "app_login_test";

function withDatabase(url: string, db: string, user?: string, password?: string): string {
  const u = new URL(url);
  u.pathname = `/${db}`;
  if (user) u.username = user;
  if (password) u.password = password;
  return u.toString();
}

/**
 * Sobe o PostgreSQL dos testes de integração.
 * - Com TEST_DATABASE_URL (ex.: serviço da CI ou Postgres local): usa esse servidor.
 * - Sem ele: sobe `postgres:17` com Testcontainers (precisa de Docker).
 */
export default async function setup(project: TestProject) {
  let adminUrl = process.env.TEST_DATABASE_URL;
  let stop: (() => Promise<unknown>) | undefined;
  if (!adminUrl) {
    const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
    const container = await new PostgreSqlContainer("postgres:17").start();
    adminUrl = container.getConnectionUri();
    stop = () => container.stop();
  }

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${DB_NAME}`);
  await admin.end();

  const ownerUrl = withDatabase(adminUrl, DB_NAME);
  await runMigrations(ownerUrl);

  // Login da aplicação: membro de app_user, sem BYPASSRLS e sem ser dono das tabelas.
  const owner = new Client({ connectionString: ownerUrl });
  await owner.connect();
  await owner.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_LOGIN}') THEN
      CREATE ROLE ${APP_LOGIN} LOGIN PASSWORD '${APP_LOGIN}' NOSUPERUSER NOBYPASSRLS IN ROLE app_user;
    END IF;
  END $$`);
  await owner.end();

  project.provide("ownerUrl", ownerUrl);
  project.provide("appUrl", withDatabase(adminUrl, DB_NAME, APP_LOGIN, APP_LOGIN));

  return async () => {
    await stop?.();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    ownerUrl: string;
    appUrl: string;
  }
}
