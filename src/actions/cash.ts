"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serverDeps } from "@/infra/server";
import { openCashSession } from "@/application/cash/sessions";
import { addCashEntry, removeCashEntry } from "@/application/cash/entries";
import { closeCashSession, countCash } from "@/application/cash/closing";
import type { RequestContext } from "@/application/context";
import { parseBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";
import { toState, withContext, type ActionState } from "./_session";

/** Caixa do dia (spec 014). Dinheiro chega como texto em pt-BR ("150,00"). */

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const optional = (form: FormData, name: string) => text(form, name) || null;

/** "150,00" ou "R$ 150,00" → 150.00; vazio → null; texto que não é número → erro no campo. */
function money(form: FormData, name: string): Result<Decimal | null> {
  const raw = text(form, name);
  if (!raw) return ok(null);
  const parsed = parseBrDecimal(raw.replace(/^R\$\s*/, ""));
  return parsed.ok ? parsed : err("INVALID_AMOUNT", name);
}

/** Obrigatório: vazio também é erro no campo. */
function requiredMoney(form: FormData, name: string): Result<Decimal> {
  const r = money(form, name);
  if (!r.ok) return r;
  return r.value ? ok(r.value) : err("INVALID_AMOUNT", name);
}

async function run<T>(fn: (ctx: RequestContext) => Promise<Result<T>>, ...paths: string[]) {
  const state = await withContext(fn);
  for (const p of ["/caixa", ...paths]) revalidatePath(p);
  return state;
}

export async function openCashSessionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const openingFloat = requiredMoney(form, "openingFloat");
  if (!openingFloat.ok) return toState(openingFloat);
  return run((ctx) =>
    openCashSession(serverDeps(), ctx, {
      openingFloat: openingFloat.value,
      note: optional(form, "note"),
      clientRequestId: text(form, "clientRequestId"),
    }),
  );
}

export async function addCashEntryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const amount = requiredMoney(form, "amount");
  if (!amount.ok) return toState(amount);
  const kind = text(form, "kind");
  return run((ctx) =>
    addCashEntry(serverDeps(), ctx, {
      kind: kind as "WITHDRAWAL" | "SUPPLY",
      amount: amount.value,
      reason: kind === "WITHDRAWAL" ? text(form, "reason") : null,
      note: optional(form, "note"),
      clientRequestId: text(form, "clientRequestId"),
    }),
  );
}

export async function removeCashEntryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((ctx) => removeCashEntry(serverDeps(), ctx, { entryId: text(form, "entryId") }));
}

/** Cédulas da calculadora: JSON `{ "100": 1 }`; vazio é total digitado. */
function denominations(form: FormData): Result<Record<string, unknown> | null> {
  const raw = text(form, "denominations");
  if (!raw) return ok(null);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return ok(parsed as Record<string, unknown>);
  } catch {
    // cai no erro abaixo
  }
  return err("DENOMINATIONS_MISMATCH", "denominations");
}

/** Contou: a tela Fechar caixa recarrega e mostra o esperado e a diferença. */
export async function countCashAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const counted = requiredMoney(form, "counted");
  if (!counted.ok) return toState(counted);
  const used = denominations(form);
  if (!used.ok) return toState(used);
  const sessionId = text(form, "sessionId");
  const state = await run(
    (ctx) => countCash(serverDeps(), ctx, { sessionId, counted: counted.value, denominations: used.value }),
    "/caixa/fechar",
    `/caixa/turnos/${sessionId}`,
  );
  if (state?.ok) redirect("/caixa/fechar");
  return state;
}

/** Fechou: vai para o relatório do turno, com Imprimir (US4-7). */
export async function closeCashSessionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const kept = money(form, "kept");
  if (!kept.ok) return toState(kept);
  const sessionId = text(form, "sessionId");
  const state = await run(
    (ctx) =>
      closeCashSession(serverDeps(), ctx, { sessionId, kept: kept.value, note: optional(form, "note") }),
    "/caixa/fechar",
    "/caixa/turnos",
    `/caixa/turnos/${sessionId}`,
  );
  if (state?.ok) redirect(`/caixa/turnos/${sessionId}?fechado=1`);
  return state;
}
