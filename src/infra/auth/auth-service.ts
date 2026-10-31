import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import type { AuthService } from "@/application/ports";
import { err, ok } from "@/domain/shared/result";
import type { Db } from "../db/db";
import { users } from "../db/schema";
import type { Auth } from "./auth";

export function betterAuthService(auth: Auth, db: Db): AuthService {
  return {
    async createUser({ email, password, name }) {
      try {
        const r = await auth.api.signUpEmail({ body: { email: email.trim().toLowerCase(), password, name } });
        return ok({ userId: r.user.id });
      } catch (e) {
        if (e instanceof APIError) {
          const code = (e.body as { code?: string } | undefined)?.code ?? "";
          if (code.includes("ALREADY_EXISTS")) return err("EMAIL_IN_USE", "email");
          if (code.includes("PASSWORD")) return err("WEAK_PASSWORD", "password");
        }
        throw e;
      }
    },
    async deleteUser(userId) {
      await db.delete(users).where(eq(users.id, userId));
    },
  };
}
