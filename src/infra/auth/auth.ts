import { v7 as uuidv7 } from "uuid";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "../db/db";
import * as schema from "../db/schema";
import type { Mailer } from "@/application/ports";

export const MIN_PASSWORD_LENGTH = 8;

export type AuthConfig = {
  db: Db;
  mailer: Mailer;
  baseURL: string;
  secret: string;
  plugins?: BetterAuthPlugin[];
};

/** Better Auth com e-mail e senha e tabelas no nosso banco (ADR 0003). */
export function createAuth(cfg: AuthConfig) {
  return betterAuth({
    baseURL: cfg.baseURL,
    secret: cfg.secret,
    database: drizzleAdapter(cfg.db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    advanced: { database: { generateId: () => uuidv7() } },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      autoSignIn: true,
      sendResetPassword: async ({ user, url }) => {
        await cfg.mailer.send({
          to: user.email,
          subject: "Redefinição de senha",
          text: `Olá, ${user.name}.\n\nPara criar uma nova senha, acesse:\n${url}\n\nSe você não pediu, ignore este e-mail.`,
        });
      },
    },
    plugins: cfg.plugins ?? [],
  });
}

export type Auth = ReturnType<typeof createAuth>;
