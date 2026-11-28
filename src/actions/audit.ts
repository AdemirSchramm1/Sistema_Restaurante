"use server";

import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import { setSmallOperation } from "@/application/audit/small-operation";
import { withContext, type ActionState } from "./_session";

/** Liga ou desliga o modo operação pequena (spec 019, US2). */
export async function setSmallOperationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const enabled = form.get("enabled") === "true";
  const version = Number.parseInt(String(form.get("version") ?? "0"), 10);
  const state = await withContext((ctx) => setSmallOperation(serverDeps(), ctx, { enabled, version }));
  revalidatePath("/equipe/operacao-pequena");
  revalidatePath("/estoque/lancamentos");
  if (state && !state.ok && state.error.code === "STALE_RECORD")
    return { ...state, error: { ...state.error, message: "Mudou em outra tela. Confira e tente de novo." } };
  return state;
}
