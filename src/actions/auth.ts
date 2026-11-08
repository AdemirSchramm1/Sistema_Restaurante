"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { serverDeps } from "@/infra/server";
import { signUpRestaurant } from "@/application/access/sign-up-restaurant";
import { requestOrigin, toState, type ActionState } from "./_session";
import { err } from "@/domain/shared/result";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function signUpAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const deps = serverDeps();
  const r = await signUpRestaurant(
    deps,
    {
      restaurantName: text(form, "restaurantName"),
      userName: text(form, "userName"),
      email: text(form, "email"),
      password: text(form, "password"),
    },
    await requestOrigin(),
  );
  if (!r.ok) return toState(r);
  redirect("/estoque/itens");
}

export async function signInAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await serverDeps().betterAuth.api.signInEmail({
      body: { email: text(form, "email").trim().toLowerCase(), password: text(form, "password") },
      headers: await headers(),
    });
  } catch (e) {
    if (e instanceof APIError)
      return {
        ok: false,
        error: { code: "VALIDATION", message: "E-mail ou senha incorretos." },
        at: Date.now(),
      };
    throw e;
  }
  // A primeira tela depende do papel (garçom não vê o estoque).
  redirect("/");
}

export async function signOutAction() {
  await serverDeps().betterAuth.api.signOut({ headers: await headers() });
  redirect("/entrar");
}

export async function requestPasswordResetAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await serverDeps().betterAuth.api.requestPasswordReset({
    body: { email: text(form, "email").trim().toLowerCase(), redirectTo: "/redefinir-senha" },
  });
  // Sempre a mesma resposta, exista o e-mail ou não.
  return { ok: true, data: null, at: Date.now() };
}

export async function resetPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const password = text(form, "password");
  if (password.length < 8) return toState(err("WEAK_PASSWORD", "password"));
  try {
    await serverDeps().betterAuth.api.resetPassword({
      body: { newPassword: password, token: text(form, "token") },
    });
  } catch (e) {
    if (e instanceof APIError)
      return {
        ok: false,
        error: { code: "INVITATION_INVALID", message: "Link inválido ou expirado. Peça um novo." },
        at: Date.now(),
      };
    throw e;
  }
  redirect("/entrar?senha-redefinida=1");
}
