import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { isId } from "../form-input";
import { TAB_ENTITY, currentTotals } from "./tabs";
import { checkPayment, type PaymentMethod } from "@/domain/billing/payment";
import type { Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

/** Pagamentos da conta da mesa (spec 011, US2 e FR-003): só inserção; tirar é outra linha. */

export type AddPaymentInput = {
  tabId: string;
  method: PaymentMethod;
  amount: Decimal;
  /** O que o cliente entregou em dinheiro; só no dinheiro. */
  received: Decimal | null;
  /** Gerado pela tela: o toque duplo devolve o mesmo pagamento. */
  clientRequestId: string;
};

const money = (v: Decimal | null) => v?.toFixed(2) ?? null;

/**
 * Lança um pagamento na conta travada: dois caixas ao mesmo tempo nunca passam do total, porque o
 * segundo espera o primeiro e confere o que falta depois dele.
 */
export async function addPayment(
  deps: Deps,
  ctx: RequestContext,
  input: AddPaymentInput,
): Promise<Result<{ paymentId: string; change: Decimal | null }>> {
  if (!isId(input.tabId)) return err("NOT_FOUND");
  if (!isId(input.clientRequestId)) return err("VALIDATION", "clientRequestId");
  const allowed = await authorize(deps, ctx, "tab.pay", TAB_ENTITY, input.tabId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const tab = await repos.tabs.lock(input.tabId);
    if (!tab) return err("NOT_FOUND");
    const same = await repos.tabs.paymentByClientRequest(tab.id, input.clientRequestId);
    if (same) return ok({ paymentId: same.id, change: same.change });
    if (tab.status !== "OPEN") return err("TAB_CLOSED");

    const { totals } = await currentTotals(repos, tab);
    const checked = checkPayment(
      { method: input.method, amount: input.amount, received: input.received },
      totals.remaining,
    );
    if (!checked.ok) return checked;
    const p = checked.value;
    const audit = auditStamp(deps, ctx);
    const paymentId = deps.ids.next();
    await repos.tabs.insertPayment(
      { id: paymentId, tabId: tab.id, ...p, clientRequestId: input.clientRequestId },
      audit,
    );
    const details = {
      paymentId,
      method: p.method,
      amount: money(p.amount),
      received: money(p.received),
      change: money(p.change),
    };
    await repos.tabs.addEvent({
      id: deps.ids.next(),
      tabId: tab.id,
      kind: "PAYMENT_ADDED",
      details,
      userId: ctx.userId,
      at: audit.at,
    });
    await repos.tabs.touch(tab.id, audit);
    await repos.audit.record({
      entity: TAB_ENTITY,
      entityId: tab.id,
      action: "UPDATE",
      changes: { paymentAdded: details },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ paymentId, change: p.change });
  });
}

/** Tira um pagamento lançado errado: ele continua na lista, marcado como tirado (US2-4). */
export async function removePayment(
  deps: Deps,
  ctx: RequestContext,
  input: { tabId: string; paymentId: string },
): Promise<Result<void>> {
  if (!isId(input.tabId) || !isId(input.paymentId)) return err("NOT_FOUND");
  const allowed = await authorize(deps, ctx, "tab.pay", TAB_ENTITY, input.tabId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const tab = await repos.tabs.lock(input.tabId);
    if (!tab) return err("NOT_FOUND");
    if (tab.status !== "OPEN") return err("TAB_CLOSED");
    const payment = await repos.tabs.getPayment(tab.id, input.paymentId);
    if (!payment) return err("NOT_FOUND");
    if (payment.removedAt) return err("ALREADY_REMOVED");
    const audit = auditStamp(deps, ctx);
    const removed = await repos.tabs.removePayment(payment.id, deps.ids.next(), audit);
    if (!removed.ok) return removed;
    const details = { paymentId: payment.id, method: payment.method, amount: money(payment.amount) };
    await repos.tabs.addEvent({
      id: deps.ids.next(),
      tabId: tab.id,
      kind: "PAYMENT_REMOVED",
      details,
      userId: ctx.userId,
      at: audit.at,
    });
    await repos.tabs.touch(tab.id, audit);
    await repos.audit.record({
      entity: TAB_ENTITY,
      entityId: tab.id,
      action: "UPDATE",
      changes: { paymentRemoved: details },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}
