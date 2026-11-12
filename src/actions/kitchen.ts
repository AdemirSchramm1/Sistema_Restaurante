"use server";

import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import { advanceOrderStatus, cancelOrder, markDelivered } from "@/application/ordering/kitchen";
import type { CancelReason, OrderStatus } from "@/domain/ordering/order";
import type { Result } from "@/domain/shared/result";
import type { RequestContext } from "@/application/context";
import { withContext, type ActionState } from "./_session";

/** Cozinha e garçom (spec 009, US4). */

const meta = (form: FormData) => ({
  id: String(form.get("id") ?? ""),
  version: Number.parseInt(String(form.get("version") ?? "0"), 10),
});

/** Trava otimista na cozinha: "Este pedido mudou em outra tela" e a tela recarrega. */
async function run(
  path: string,
  fn: (ctx: RequestContext) => Promise<Result<unknown>>,
): Promise<ActionState> {
  const state = await withContext(fn);
  revalidatePath(path);
  if (state && !state.ok && state.error.code === "STALE_RECORD")
    return { ...state, error: { ...state.error, message: "Este pedido mudou em outra tela." } };
  return state;
}

export async function advanceOrderStatusAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const to = String(form.get("to") ?? "") as OrderStatus;
  return run("/pedidos/cozinha", (ctx) => advanceOrderStatus(serverDeps(), ctx, { ...meta(form), to }));
}

export async function cancelOrderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const reason = String(form.get("reason") ?? "") as CancelReason;
  const note = form.get("note");
  // Spec 011, US5: só vem depois do preparo ("Sim" = perda, "Não" = volta para o estoque).
  const used = form.get("ingredientsUsed");
  const ingredientsUsed = used === "true" ? true : used === "false" ? false : undefined;
  return run("/pedidos/cozinha", (ctx) =>
    cancelOrder(serverDeps(), ctx, {
      ...meta(form),
      reason,
      note: typeof note === "string" ? note : null,
      ingredientsUsed,
    }),
  );
}

export async function markDeliveredAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run("/pedidos/garcom", (ctx) => markDelivered(serverDeps(), ctx, meta(form)));
}
