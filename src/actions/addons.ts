"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import { createAddon, setAddonActive, updateAddon } from "@/application/ordering/addons";
import { parseAddonForm } from "@/application/ordering/addon-input";
import { formDataToObject } from "@/application/form-input";
import { withContext, type ActionState } from "./_session";

/** Adicionais (spec 010, US1). */

const meta = (form: FormData) => ({
  id: String(form.get("id") ?? ""),
  version: Number.parseInt(String(form.get("version") ?? "0"), 10),
});
const fields = (form: FormData) => {
  const { id: _id, version: _v, ...rest } = formDataToObject(form);
  return rest;
};

export async function createAddonAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext(async (ctx) => {
    const parsed = parseAddonForm(fields(form));
    if (!parsed.ok) return parsed;
    return createAddon(serverDeps(), ctx, parsed.value);
  });
  if (state?.ok) redirect(`/pedidos/adicionais/${(state.data as { id: string }).id}?criado=1`);
  return state;
}

export async function updateAddonAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { id, version } = meta(form);
  const state = await withContext(async (ctx) => {
    const parsed = parseAddonForm(fields(form));
    if (!parsed.ok) return parsed;
    return updateAddon(serverDeps(), ctx, { ...parsed.value, id, version });
  });
  if (state?.ok) revalidatePath(`/pedidos/adicionais/${id}`);
  return state;
}

export async function setAddonActiveAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { id, version } = meta(form);
  const state = await withContext((ctx) =>
    setAddonActive(serverDeps(), ctx, { id, version, active: form.get("active") === "true" }),
  );
  if (state?.ok) revalidatePath(`/pedidos/adicionais/${id}`);
  return state;
}
