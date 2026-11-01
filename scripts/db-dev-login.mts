import { Client } from "pg";

/**
 * Só para desenvolvimento e CI: cria o login `app_login` (membro de app_user, sem BYPASSRLS).
 * Em produção, crie o login pelo painel do provedor e faça `GRANT app_user TO <login>`.
 */
const url = process.env.DATABASE_MIGRATION_URL;
if (!url) throw new Error("Defina DATABASE_MIGRATION_URL");
const c = new Client({ connectionString: url });
await c.connect();
await c.query(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_login') THEN
    CREATE ROLE app_login LOGIN PASSWORD 'app_login' NOSUPERUSER NOBYPASSRLS IN ROLE app_user;
  END IF;
END $$`);
await c.end();
console.log("Login app_login pronto.");
