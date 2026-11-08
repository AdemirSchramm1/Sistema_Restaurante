"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import { createRecipe, setRecipeActive, updateRecipe } from "@/application/inventory/recipes";
import { parseRecipeForm, parseSalePriceForm } from "@/application/inventory/recipe-input";
import { setRecipeSalePrice } from "@/application/inventory/product-costs";
import { formDataToObject } from "@/application/inventory/item-input";
import { withContext, type ActionState } from "./_session";

function splitMeta(form: FormData) {
  const { id, version, ...fields } = formDataToObject(form) as Record<string, unknown> & {
    id?: string;
    version?: string;
  };
  return { id: id ?? "", version: Number.parseInt(version ?? "0", 10), fields };
}

export async function createRecipeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext(async (ctx) => {
    const parsed = parseRecipeForm(splitMeta(form).fields);
    if (!parsed.ok) return parsed;
    return createRecipe(serverDeps(), ctx, parsed.value);
  });
  if (state?.ok) redirect(`/estoque/produtos/${(state.data as { id: string }).id}?criado=1`);
  return state;
}

export async function updateRecipeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { id, version, fields } = splitMeta(form);
  const state = await withContext(async (ctx) => {
    const parsed = parseRecipeForm(fields);
    if (!parsed.ok) return parsed;
    return updateRecipe(serverDeps(), ctx, id, version, parsed.value);
  });
  if (state?.ok) revalidatePath(`/estoque/produtos/${id}`);
  return state;
}

export async function setRecipeActiveAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id"));
  const version = Number.parseInt(String(form.get("version")), 10);
  const active = form.get("active") === "true";
  const state = await withContext((ctx) => setRecipeActive(serverDeps(), ctx, id, version, active));
  if (state?.ok) revalidatePath(`/estoque/produtos/${id}`);
  return state;
}

/** Salva o preço de venda do produto (spec 008, US1). */
export async function setSalePriceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = parseSalePriceForm(formDataToObject(form));
  const state = await withContext(async (ctx) => {
    if (!parsed.ok) return parsed;
    const { id, version, salePrice } = parsed.value;
    return setRecipeSalePrice(serverDeps(), ctx, id, version, salePrice);
  });
  if (state?.ok && parsed.ok) {
    revalidatePath(`/estoque/produtos/${parsed.value.id}`);
    revalidatePath("/estoque/custos");
  }
  return state;
}
