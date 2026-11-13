"use server";

import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import {
  cancelAdjustment,
  decideAdjustment,
  registerLoss,
  registerPurchase,
  requestAdjustment,
  reverseMovement,
} from "@/application/inventory/movements";
import { parseMovementForm, parseReversalForm } from "@/application/inventory/movement-input";
import { formDataToObject } from "@/application/form-input";
import { ok, type Result } from "@/domain/shared/result";
import { withContext, type ActionState } from "./_session";

const refresh = () => {
  revalidatePath("/estoque/lancamentos");
  revalidatePath("/estoque/itens", "layout");
};

export async function registerMovementAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext(async (ctx): Promise<Result<{ id: string }>> => {
    const deps = serverDeps();
    const parsed = parseMovementForm(formDataToObject(form), deps.clock.now());
    if (!parsed.ok) return parsed;
    const p = parsed.value;
    // Só ids voltam para a tela (decimal não atravessa a Server Action).
    const r =
      p.type === "PURCHASE"
        ? await registerPurchase(deps, ctx, p.cmd)
        : p.type === "LOSS"
          ? await registerLoss(deps, ctx, p.cmd)
          : await requestAdjustment(deps, ctx, p.cmd);
    if (!r.ok) return r;
    return ok({ id: "movementId" in r.value ? r.value.movementId : r.value.requestId });
  });
  if (state?.ok) refresh();
  return state;
}

export async function reverseMovementAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext(async (ctx) => {
    const parsed = parseReversalForm(formDataToObject(form));
    if (!parsed.ok) return parsed;
    return reverseMovement(serverDeps(), ctx, parsed.value.movementId, parsed.value.cmd);
  });
  if (state?.ok) refresh();
  return state;
}

export async function decideAdjustmentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("requestId") ?? "");
  const approve = form.get("decision") === "approve";
  const notes = String(form.get("notes") ?? "") || null;
  const state = await withContext((ctx) => decideAdjustment(serverDeps(), ctx, id, approve, notes));
  if (state?.ok) refresh();
  return state;
}

export async function cancelAdjustmentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("requestId") ?? "");
  const state = await withContext((ctx) => cancelAdjustment(serverDeps(), ctx, id));
  if (state?.ok) refresh();
  return state;
}
