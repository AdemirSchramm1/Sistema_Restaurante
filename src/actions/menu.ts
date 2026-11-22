"use server";

import { serverDeps } from "@/infra/server";
import { submitOrder } from "@/application/ordering/submit-order";
import { menuCookies } from "./_menu-cookies";
import { toState, type ActionState } from "./_session";
import type { SubmitOrderResult } from "@/application/ordering/submit-order";

/** Ações do cardápio público (spec 009, contracts/public-routes.md). O acesso vem só do cookie. */

export async function submitOrderAction(input: unknown): Promise<ActionState<SubmitOrderResult>> {
  return toState(await submitOrder(serverDeps(), await menuCookies(), input));
}
