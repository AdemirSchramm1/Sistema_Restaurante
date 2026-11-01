import "server-only";
import { nextCookies } from "better-auth/next-js";
import { createDb } from "./db/db";
import { makeDeps } from "./deps";
import { MemoryMailer } from "./mailer/memory";
import { ResendMailer } from "./mailer/resend";
import { FileMailer } from "./mailer/file";
import type { Mailer } from "@/application/ports";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Defina ${name} (veja .env.example)`);
  return v;
}

function mailer(): Mailer {
  if (process.env.MAILER === "file") return new FileMailer(env("MAIL_DIR"));
  if (process.env.MAILER === "resend") return new ResendMailer(env("RESEND_API_KEY"), env("MAIL_FROM"));
  return new MemoryMailer(true);
}

type ServerDeps = ReturnType<typeof makeDeps>;
const g = globalThis as unknown as { __deps?: ServerDeps };

/** Dependências do servidor (uma instância por processo). */
export function serverDeps(): ServerDeps {
  return (g.__deps ??= makeDeps({
    db: createDb(env("DATABASE_URL")),
    mailer: mailer(),
    appUrl: env("BETTER_AUTH_URL"),
    authSecret: env("BETTER_AUTH_SECRET"),
    authPlugins: [nextCookies()],
  }));
}
