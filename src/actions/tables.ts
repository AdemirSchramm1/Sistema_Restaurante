"use server";

import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import {
  createTable,
  createTablesInRange,
  renameTable,
  rotateTableQr,
  setTableActive,
} from "@/application/ordering/tables";
import { createTabletLink, releaseTablet, rotateTabletLink } from "@/application/ordering/tablets";
import { withContext, type ActionState } from "./_session";

/** Mesas e QR codes (spec 009, US1). */

const PATH = "/pedidos/mesas";
const meta = (form: FormData) => ({
  id: String(form.get("id") ?? ""),
  version: Number.parseInt(String(form.get("version") ?? "0"), 10),
});
const int = (v: FormDataEntryValue | null) => Number(String(v ?? "").trim() || Number.NaN);

export async function createTableAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext((ctx) =>
    createTable(serverDeps(), ctx, { name: String(form.get("name") ?? "") }),
  );
  if (state?.ok) revalidatePath(PATH);
  return state;
}

export async function createTablesInRangeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext((ctx) =>
    createTablesInRange(serverDeps(), ctx, { from: int(form.get("from")), to: int(form.get("to")) }),
  );
  if (state?.ok) revalidatePath(PATH);
  return state;
}

export async function renameTableAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext((ctx) =>
    renameTable(serverDeps(), ctx, { ...meta(form), name: String(form.get("name") ?? "") }),
  );
  if (state?.ok) revalidatePath(PATH);
  return state;
}

export async function setTableActiveAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext((ctx) =>
    setTableActive(serverDeps(), ctx, { ...meta(form), active: form.get("active") === "true" }),
  );
  if (state?.ok) revalidatePath(PATH);
  return state;
}

export async function rotateTableQrAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext((ctx) => rotateTableQr(serverDeps(), ctx, meta(form)));
  if (state?.ok) revalidatePath(PATH);
  return state;
}

/** Tablet da mesa (spec 016, US4). */
const tablet = (form: FormData) => {
  const { id, version } = meta(form);
  return { tableId: id, version };
};

export async function createTabletLinkAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext((ctx) => createTabletLink(serverDeps(), ctx, tablet(form)));
  if (state?.ok) revalidatePath(PATH);
  return state;
}

export async function releaseTabletAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext((ctx) =>
    releaseTablet(serverDeps(), ctx, { tableId: tablet(form).tableId }),
  );
  if (state?.ok) revalidatePath(PATH);
  return state;
}

export async function rotateTabletLinkAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await withContext((ctx) => rotateTabletLink(serverDeps(), ctx, tablet(form)));
  if (state?.ok) revalidatePath(PATH);
  return state;
}
