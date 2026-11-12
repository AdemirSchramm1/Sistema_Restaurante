"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serverDeps } from "@/infra/server";
import { closeTab, reopenTab, setServiceWaived } from "@/application/billing/tabs";
import { addPayment, removePayment } from "@/application/billing/payments";
import { setServiceChargeRate } from "@/application/billing/settings";
import type { RequestContext } from "@/application/context";
import { isPaymentMethod } from "@/domain/billing/payment";
import { parseBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";
import { toState, withContext, type ActionState } from "./_session";

/** Caixa: conta da mesa (spec 011). Dinheiro chega como texto em pt-BR ("12,50"). */

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const int = (form: FormData, name: string) => Number.parseInt(text(form, name) || "0", 10);

/** Trava otimista da conta: "A conta mudou. Confira de novo." e a tela recarrega. */
async function run(
  tabId: string | null,
  fn: (ctx: RequestContext) => Promise<Result<unknown>>,
): Promise<ActionState> {
  const state = await withContext(fn);
  revalidatePath("/caixa");
  if (tabId) revalidatePath(`/caixa/${tabId}`);
  if (state && !state.ok && state.error.code === "STALE_RECORD")
    return { ...state, error: { ...state.error, message: "A conta mudou. Confira de novo." } };
  return state;
}

export async function setServiceWaivedAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const tabId = text(form, "tabId");
  return run(tabId, (ctx) =>
    setServiceWaived(serverDeps(), ctx, {
      tabId,
      waived: text(form, "waived") === "true",
      version: int(form, "version"),
    }),
  );
}

export async function setServiceChargeRateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = text(form, "rate").replace("%", "").trim();
  let rate: Decimal | null = null;
  if (raw) {
    const parsed = parseBrDecimal(raw);
    if (!parsed.ok) return toState(err("INVALID_RATE", "serviceChargeRate"));
    rate = parsed.value;
  }
  const version = int(form, "version");
  return run(null, (ctx) => setServiceChargeRate(serverDeps(), ctx, { rate, version }));
}

/** "12,50" → 12.50; vazio → null; texto que não é número → erro no campo. */
function money(form: FormData, name: string): Result<Decimal | null> {
  const raw = text(form, name);
  if (!raw) return ok(null);
  const parsed = parseBrDecimal(raw.replace(/^R\$\s*/, ""));
  return parsed.ok ? parsed : err("INVALID_AMOUNT", name);
}

export async function addPaymentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const tabId = text(form, "tabId");
  const method = text(form, "method");
  if (!isPaymentMethod(method))
    return { ok: false, error: { code: "VALIDATION", field: "method", message: "Escolha a forma de pagamento." }, at: Date.now() };
  const amount = money(form, "amount");
  if (!amount.ok) return toState(amount);
  if (!amount.value) return toState(err("INVALID_AMOUNT", "amount"));
  const received = money(form, "received");
  if (!received.ok) return toState(received);
  const input = {
    tabId,
    method,
    amount: amount.value,
    received: method === "CASH" ? received.value : null,
    clientRequestId: text(form, "clientRequestId"),
  };
  return run(tabId, async (ctx) => {
    const r = await addPayment(serverDeps(), ctx, input);
    return r.ok ? ok({ paymentId: r.value.paymentId, change: r.value.change?.toFixed(2) ?? null }) : r;
  });
}

export async function removePaymentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const tabId = text(form, "tabId");
  return run(tabId, (ctx) => removePayment(serverDeps(), ctx, { tabId, paymentId: text(form, "paymentId") }));
}

/** Fechou: volta para o Caixa, que mostra a mesa livre. */
export async function closeTabAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const tabId = text(form, "tabId");
  const state = await run(tabId, (ctx) => closeTab(serverDeps(), ctx, { tabId, version: int(form, "version") }));
  if (state?.ok) redirect(`/caixa?fechada=${encodeURIComponent(text(form, "tableName"))}`);
  return state;
}

export async function reopenTabAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const tabId = text(form, "tabId");
  return run(tabId, (ctx) =>
    reopenTab(serverDeps(), ctx, { tabId, reason: String(form.get("reason") ?? ""), version: int(form, "version") }),
  );
}
