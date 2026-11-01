"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import { createItem } from "@/application/inventory/create-item";
import { updateItem } from "@/application/inventory/update-item";
import { setItemActive } from "@/application/inventory/set-item-active";
import { setItemCogsOverride } from "@/application/inventory/set-item-cogs-override";
import { setItemLocations } from "@/application/inventory/set-item-locations";
import { formDataToObject, parseItemForm } from "@/application/inventory/item-input";
import { withContext, type ActionState } from "./_session";

function splitMeta(form: FormData) {
  const raw = formDataToObject(form);
  const { id, version, ...fields } = raw as Record<string, unknown> & { id?: string; version?: string };
  return { id: id ?? "", version: Number.parseInt(version ?? "0", 10), fields };
}

export async function createItemAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext(async (ctx) => {
    const parsed = parseItemForm(splitMeta(form).fields);
    if (!parsed.ok) return parsed;
    return createItem(serverDeps(), ctx, parsed.value);
  });
  if (state?.ok) redirect(`/estoque/itens/${(state.data as { id: string }).id}?criado=1`);
  return state;
}

export async function updateItemAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { id, version, fields } = splitMeta(form);
  const state = await withContext(async (ctx) => {
    const parsed = parseItemForm(fields);
    if (!parsed.ok) return parsed;
    return updateItem(serverDeps(), ctx, id, version, parsed.value);
  });
  if (state?.ok) revalidatePath(`/estoque/itens/${id}`);
  return state;
}

export async function setItemActiveAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id"));
  const version = Number.parseInt(String(form.get("version")), 10);
  const active = form.get("active") === "true";
  const state = await withContext((ctx) => setItemActive(serverDeps(), ctx, id, version, active));
  if (state?.ok) revalidatePath(`/estoque/itens/${id}`);
  return state;
}

export async function setItemCogsOverrideAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id"));
  const version = Number.parseInt(String(form.get("version")), 10);
  const raw = String(form.get("override"));
  const value = raw === "true" ? true : raw === "false" ? false : null;
  const state = await withContext((ctx) => setItemCogsOverride(serverDeps(), ctx, id, version, value));
  if (state?.ok) revalidatePath(`/estoque/itens/${id}`);
  return state;
}

/** Campos: `loc` (ids marcados) e `default` (id do local principal). */
export async function setItemLocationsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const itemId = String(form.get("itemId"));
  const defaultId = form.get("default");
  const links = form.getAll("loc").map((v) => ({
    locationId: String(v),
    isDefault: defaultId === String(v),
  }));
  const state = await withContext((ctx) => setItemLocations(serverDeps(), ctx, itemId, links));
  if (state?.ok) revalidatePath(`/estoque/itens/${itemId}`);
  return state;
}
