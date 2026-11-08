"use server";

import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import { setAcceptingQrOrders } from "@/application/ordering/orders";
import { setProductSoldOut } from "@/application/ordering/kitchen";
import { withContext, type ActionState } from "./_session";

/** Chave de pedidos (spec 009, US6) e esgotado hoje (US5). */

export async function setAcceptingQrOrdersAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext((ctx) =>
    setAcceptingQrOrders(serverDeps(), ctx, {
      accepting: form.get("accepting") === "true",
      version: Number.parseInt(String(form.get("version") ?? "0"), 10),
    }),
  );
  if (state?.ok) revalidatePath("/pedidos/mesas");
  return state;
}

export async function setProductSoldOutAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const recipeId = String(form.get("recipeId") ?? "");
  const state = await withContext((ctx) =>
    setProductSoldOut(serverDeps(), ctx, { recipeId, soldOut: form.get("soldOut") === "true" }),
  );
  if (state?.ok) {
    revalidatePath("/pedidos/cozinha");
    revalidatePath(`/estoque/produtos/${recipeId}`);
  }
  return state;
}
