"use server";

import { cookies } from "next/headers";
import { serverDeps } from "@/infra/server";
import { submitOrder } from "@/application/ordering/submit-order";
import { listAccessOrders } from "@/application/ordering/menu";
import { MENU_ACCESS_COOKIE } from "./_qr-scan";
import { toState, type ActionState } from "./_session";
import type { SubmitOrderResult } from "@/application/ordering/submit-order";
import type { AccessOrderView } from "@/application/ordering/menu";

/** Ações do cardápio público (spec 009, contracts/public-routes.md). O acesso vem só do cookie. */

const accessCookie = async () => (await cookies()).get(MENU_ACCESS_COOKIE)?.value ?? null;

export async function submitOrderAction(input: unknown): Promise<ActionState<SubmitOrderResult>> {
  return toState(await submitOrder(serverDeps(), await accessCookie(), input));
}

export async function listAccessOrdersAction(): Promise<ActionState<AccessOrderView[]>> {
  return toState(await listAccessOrders(serverDeps(), await accessCookie()));
}
