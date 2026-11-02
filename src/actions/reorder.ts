"use server";

import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import { setReorderLevels } from "@/application/inventory/reorder";
import { parseReorderForm } from "@/application/inventory/reorder-input";
import { formDataToObject } from "@/application/inventory/item-input";
import { withContext, type ActionState } from "./_session";

/** Salva o aviso de reposição do item (spec 006, US1). */
export async function setReorderLevelsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = parseReorderForm(formDataToObject(form));
  const state = await withContext(async (ctx) => {
    if (!parsed.ok) return parsed;
    const { id, version, levels } = parsed.value;
    return setReorderLevels(serverDeps(), ctx, id, version, levels);
  });
  if (state?.ok && parsed.ok) {
    revalidatePath(`/estoque/itens/${parsed.value.id}`);
    revalidatePath("/estoque/repor");
  }
  return state;
}
