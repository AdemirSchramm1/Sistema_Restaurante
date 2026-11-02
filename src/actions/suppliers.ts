"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import {
  addSupplierItem,
  createSupplier,
  removeSupplierItem,
  setSupplierActive,
  updateSupplier,
  updateSupplierItem,
} from "@/application/suppliers/suppliers";
import { parseSupplierForm, parseSupplierItemForm } from "@/application/suppliers/supplier-input";
import { formDataToObject } from "@/application/inventory/item-input";
import { ok } from "@/domain/shared/result";
import { withContext, type ActionState } from "./_session";

/** Campos do fornecedor, com os dias de entrega (vários checkboxes de mesmo nome). */
function supplierFields(form: FormData) {
  const { id: _id, version: _v, ...fields } = formDataToObject(form);
  return { ...fields, deliveryDays: form.getAll("deliveryDays").map(String) };
}
const meta = (form: FormData) => ({
  id: String(form.get("id") ?? ""),
  version: Number.parseInt(String(form.get("version") ?? "0"), 10),
});

export async function createSupplierAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext(async (ctx) => {
    const parsed = parseSupplierForm(supplierFields(form));
    if (!parsed.ok) return parsed;
    return createSupplier(serverDeps(), ctx, parsed.value);
  });
  if (state?.ok) redirect(`/estoque/fornecedores/${(state.data as { id: string }).id}?criado=1`);
  return state;
}

export async function updateSupplierAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { id, version } = meta(form);
  const state = await withContext(async (ctx) => {
    const parsed = parseSupplierForm(supplierFields(form));
    if (!parsed.ok) return parsed;
    return updateSupplier(serverDeps(), ctx, id, version, parsed.value);
  });
  if (state?.ok) revalidatePath(`/estoque/fornecedores/${id}`);
  return state;
}

export async function setSupplierActiveAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { id, version } = meta(form);
  const active = form.get("active") === "true";
  const state = await withContext((ctx) => setSupplierActive(serverDeps(), ctx, id, version, active));
  if (state?.ok) revalidatePath(`/estoque/fornecedores/${id}`);
  return state;
}

export async function addSupplierItemAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const supplierId = String(form.get("supplierId") ?? "");
  const state = await withContext(async (ctx) => {
    const { supplierId: _s, ...fields } = formDataToObject(form);
    const parsed = parseSupplierItemForm(fields);
    if (!parsed.ok) return parsed;
    return addSupplierItem(serverDeps(), ctx, supplierId, parsed.value);
  });
  if (state?.ok) revalidatePath("/estoque", "layout");
  return state;
}

export async function updateSupplierItemAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { id, version } = meta(form);
  const state = await withContext(async (ctx) => {
    const { id: _i, version: _v, ...fields } = formDataToObject(form);
    const parsed = parseSupplierItemForm(fields, { requireItem: false });
    if (!parsed.ok) return parsed;
    const { itemId: _item, ...data } = parsed.value;
    return updateSupplierItem(serverDeps(), ctx, id, version, data);
  });
  if (state?.ok) revalidatePath("/estoque", "layout");
  return state;
}

export async function removeSupplierItemAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id") ?? "");
  const state = await withContext(async (ctx) => {
    const r = await removeSupplierItem(serverDeps(), ctx, id);
    return r.ok ? ok({ id }) : r;
  });
  if (state?.ok) revalidatePath("/estoque", "layout");
  return state;
}
