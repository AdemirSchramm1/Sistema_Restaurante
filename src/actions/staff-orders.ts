"use server";

import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import { cancelOrder, markDelivered } from "@/application/ordering/kitchen";
import { placeStaffOrder, type PlaceStaffOrderResult } from "@/application/ordering/staff-orders";
import type { CancelReason } from "@/domain/ordering/order";
import { withContext, type ActionState } from "./_session";

/** Lançar pedido pelo garçom (spec 015). */

const LAYOUT = "/pedidos/lancar";

const meta = (form: FormData) => ({
  id: String(form.get("id") ?? ""),
  version: Number.parseInt(String(form.get("version") ?? "0"), 10),
});

/**
 * Envia o carrinho. Não revalida a tela da mesa: o cliente decide o que mostrar pela resposta
 * (e o AutoRefresh traz o pedido novo em Pedidos da mesa).
 */
export async function placeStaffOrderAction(input: unknown): Promise<ActionState<PlaceStaffOrderResult>> {
  const state = await withContext((ctx) => placeStaffOrder(serverDeps(), ctx, input));
  if (state?.ok) {
    revalidatePath(LAYOUT, "layout");
    revalidatePath("/pedidos/cozinha");
  }
  return state;
}

/** Cancelar o próprio pedido ainda em Recebido (US4); o gerente e o chef cancelam qualquer um. */
export async function cancelOwnOrderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const reason = String(form.get("reason") ?? "") as CancelReason;
  const note = form.get("note");
  const state = await withContext((ctx) =>
    cancelOrder(serverDeps(), ctx, { ...meta(form), reason, note: typeof note === "string" ? note : null }),
  );
  revalidatePath(LAYOUT, "layout");
  if (state && !state.ok && state.error.code === "STALE_RECORD")
    return { ...state, error: { ...state.error, message: "Este pedido mudou em outra tela." } };
  return state;
}

/** Entregue a partir de Pedidos da mesa. */
export async function deliverFromTableAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext((ctx) => markDelivered(serverDeps(), ctx, meta(form)));
  revalidatePath(LAYOUT, "layout");
  revalidatePath("/pedidos/garcom");
  if (state && !state.ok && state.error.code === "STALE_RECORD")
    return { ...state, error: { ...state.error, message: "Este pedido mudou em outra tela." } };
  return state;
}
