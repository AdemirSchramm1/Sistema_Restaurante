import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { serverDeps } from "@/infra/server";
import { resolveContext } from "@/application/access/resolve-context";
import type { Origin, RequestContext } from "@/application/context";
import type { DomainError, Result } from "@/domain/shared/result";
import { messageFor } from "@/components/forms/error-messages";

export type ActionError = DomainError & { message: string };
export type ActionState<T = unknown> =
  { ok: true; data: T; at: number } | { ok: false; error: ActionError; at: number } | null;

export async function requestOrigin(): Promise<Origin> {
  const h = await headers();
  return {
    channel: "web",
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
}

/**
 * Sessão do Better Auth. `cache()` do React: layouts e página do mesmo carregamento leem a sessão
 * uma vez só (spec 012, R3). Fora da renderização (Server Action), roda a cada chamada.
 */
const currentSession = cache(async () =>
  serverDeps().betterAuth.api.getSession({ headers: await headers() }),
);

/** Contexto do usuário logado, ou null. Uma vez por carregamento de tela (spec 012, R3). */
export const currentContext = cache(async (): Promise<RequestContext | null> => {
  const session = await currentSession();
  if (!session) return null;
  return resolveContext(serverDeps(), session.user.id, await requestOrigin());
});

export async function currentUser() {
  return (await currentSession())?.user ?? null;
}

/** Para páginas: exige sessão com restaurante. */
export async function requireContext(): Promise<RequestContext> {
  const ctx = await currentContext();
  if (!ctx) {
    if (await currentUser()) redirect("/sem-acesso");
    redirect("/entrar");
  }
  return ctx;
}

/** Resposta de uma Server Action que já rodou: nunca o `null` do estado inicial do formulário. */
export type ActionResult<T = unknown> = NonNullable<ActionState<T>>;

export function toState<T>(r: Result<T>): ActionResult<T> {
  return r.ok
    ? { ok: true, data: r.value, at: Date.now() }
    : { ok: false, error: { ...r.error, message: messageFor(r.error) }, at: Date.now() };
}

/** Envolve uma Server Action: sessão obrigatória, contexto montado no servidor. */
export async function withContext<T>(
  fn: (ctx: RequestContext) => Promise<Result<T>>,
): Promise<ActionState<T>> {
  const ctx = await currentContext();
  if (!ctx) return toState<T>({ ok: false, error: { code: "UNAUTHENTICATED" } });
  return toState(await fn(ctx));
}
