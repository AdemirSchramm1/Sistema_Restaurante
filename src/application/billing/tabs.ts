import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { isId } from "../form-input";
import type { ClosedTabRow, TabEventRecord, TabPaymentRecord, TabRecord, TabStatus } from "./ports";
import type { OrderLineView } from "../ordering/ports";
import type { CancelReason, OrderStatus } from "@/domain/ordering/order";
import {
  checkClose,
  checkReopenReason,
  closeBlockers,
  closedSummary,
  isPendingOrder,
  tabTotals,
  type CloseBlocker,
} from "@/domain/billing/tab";
import type { PaymentMethod } from "@/domain/billing/payment";
import { checkPeriod } from "../ordering/orders";
import { businessDay } from "@/domain/ordering/business-day";
import type { Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

/** Caixa: contas da mesa (spec 011, US1, US2 e US6; contracts/use-cases.md). */

export const TAB_ENTITY = "table_tab";

export type OpenTabView = {
  id: string;
  tableName: string;
  openedAt: Date;
  total: Decimal;
  paid: Decimal;
  remaining: Decimal;
  pendingOrders: number;
  version: number;
};

export type TabOrderView = {
  id: string;
  number: number;
  status: OrderStatus;
  cancelReason: CancelReason | null;
  cancelNote: string | null;
  total: Decimal;
  submittedAt: Date;
  lines: OrderLineView[];
};

export type TabView = {
  id: string;
  tableId: string;
  tableName: string;
  restaurantName: string;
  timezone: string;
  status: TabStatus;
  openedAt: Date;
  closedAt: Date | null;
  closedByName: string | null;
  version: number;
  orders: TabOrderView[];
  subtotal: Decimal;
  serviceRate: Decimal | null;
  serviceWaived: boolean;
  serviceCharge: Decimal;
  total: Decimal;
  paid: Decimal;
  remaining: Decimal;
  pendingOrders: number;
  canClose: boolean;
  blockers: CloseBlocker[];
  payments: TabPaymentRecord[];
  events: TabEventRecord[];
  serverNow: string;
};

/** Mesas com conta aberta, a mais antiga primeiro, com o total de agora. */
export async function listOpenTabs(
  deps: Deps,
  ctx: RequestContext,
): Promise<Result<{ tabs: OpenTabView[]; serverNow: string }>> {
  const allowed = await authorize(deps, ctx, "tab.read", TAB_ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const rows = await repos.tabs.listOpen();
    return ok({
      serverNow: deps.clock.now().toISOString(),
      tabs: rows.map((t) => {
        const totals = tabTotals(t);
        return {
          id: t.id,
          tableName: t.tableName,
          openedAt: t.openedAt,
          total: totals.total,
          paid: totals.paid,
          remaining: totals.remaining,
          pendingOrders: t.orders.filter((o) => isPendingOrder(o.status)).length,
          version: t.version,
        };
      }),
    });
  });
}

/** Conta com tudo o que a tela mostra, aberta ou fechada. Roda na transação de quem chama. */
export async function loadTab(deps: Deps, repos: Repos, id: string): Promise<Result<TabView>> {
  const tab = await repos.tabs.get(id);
  if (!tab) return err("NOT_FOUND");
  const orders = await repos.orders.listForTab(id);
  const payments = await repos.tabs.payments(id);
  const totals = tabTotals({
    orders,
    payments: activePayments(payments),
    serviceRate: tab.serviceRate,
    serviceWaived: tab.serviceWaived,
  });
  const blockers = tab.status === "OPEN" ? closeBlockers(totals, orders) : [];
  const settings = await repos.orderingSettings.get();
  return ok({
    id: tab.id,
    tableId: tab.tableId,
    tableName: tab.tableName,
    restaurantName: settings.restaurantName,
    timezone: settings.timezone,
    status: tab.status,
    openedAt: tab.openedAt,
    closedAt: tab.closedAt,
    closedByName: tab.closedByName,
    version: tab.version,
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      cancelReason: o.cancelReason,
      cancelNote: o.cancelNote,
      total: o.total,
      submittedAt: o.submittedAt,
      lines: o.lines,
    })),
    ...totals,
    serviceRate: tab.serviceRate,
    serviceWaived: tab.serviceWaived,
    pendingOrders: orders.filter((o) => isPendingOrder(o.status)).length,
    canClose: tab.status === "OPEN" && blockers.length === 0,
    blockers,
    payments,
    events: await repos.tabs.events(id),
    serverNow: deps.clock.now().toISOString(),
  });
}

export async function getTab(deps: Deps, ctx: RequestContext, id: string): Promise<Result<TabView>> {
  if (!isId(id)) return err("NOT_FOUND");
  const allowed = await authorize(deps, ctx, "tab.read", TAB_ENTITY, id);
  if (!allowed.ok) return allowed;
  const tab = await deps.tenant(ctx.restaurantId, (repos) => loadTab(deps, repos, id));
  if (!tab.ok || tab.value.status === "OPEN") return tab;
  // Conta fechada é consulta de contas (FR-010): só gerente e caixa, mesmo pelo link.
  const history = await authorize(deps, ctx, "tab.history", TAB_ENTITY, id);
  return history.ok ? tab : history;
}

/** Pagamentos que valem (não tirados), no formato do domínio. */
export const activePayments = (payments: { amount: Decimal; removedAt: Date | null }[]) =>
  payments.map((p) => ({ amount: p.amount, removed: p.removedAt !== null }));

/** Pedidos, pagamentos e totais de agora da conta (já travada por quem chama). */
export async function currentTotals(repos: Repos, tab: TabRecord, serviceWaived = tab.serviceWaived) {
  const orders = await repos.orders.listForTab(tab.id);
  const payments = await repos.tabs.payments(tab.id);
  const totals = tabTotals({
    orders,
    payments: activePayments(payments),
    serviceRate: tab.serviceRate,
    serviceWaived,
  });
  return { orders, payments, totals };
}

/**
 * Tira (ou põe de volta) a taxa de serviço desta conta (US1-8). Tirar é recusado se o que já foi
 * pago passaria do novo total: a tela pede para tirar um pagamento antes.
 */
export async function setServiceWaived(
  deps: Deps,
  ctx: RequestContext,
  input: { tabId: string; waived: boolean; version: number },
): Promise<Result<void>> {
  if (!isId(input.tabId)) return err("NOT_FOUND");
  const allowed = await authorize(deps, ctx, "tab.pay", TAB_ENTITY, input.tabId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const tab = await repos.tabs.lock(input.tabId);
    if (!tab) return err("NOT_FOUND");
    if (tab.status !== "OPEN") return err("TAB_CLOSED");
    if (tab.version !== input.version) return err("STALE_RECORD");
    if (tab.serviceRate === null) return err("NO_SERVICE_CHARGE");
    if (tab.serviceWaived === input.waived) return ok(undefined);
    if (input.waived) {
      const { totals } = await currentTotals(repos, tab, true);
      if (totals.remaining.isNegative())
        return err("PAYMENT_EXCEEDS_REMAINING", undefined, {
          total: totals.total.toFixed(2),
          paid: totals.paid.toFixed(2),
        });
    }
    const audit = auditStamp(deps, ctx);
    await repos.tabs.setServiceWaived(tab.id, input.waived, audit);
    await repos.tabs.addEvent({
      id: deps.ids.next(),
      tabId: tab.id,
      kind: input.waived ? "SERVICE_WAIVED" : "SERVICE_RESTORED",
      userId: ctx.userId,
      at: audit.at,
    });
    await repos.audit.record({
      entity: TAB_ENTITY,
      entityId: tab.id,
      action: "UPDATE",
      changes: { serviceWaived: [tab.serviceWaived, input.waived] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

/**
 * Fecha a conta e libera a mesa (US2-5): falta R$ 0,00 e nada pendente na cozinha. Grava o retrato
 * dos valores e o dia local do fechamento, e encerra os acessos ao cardápio da mesa: o próximo
 * pedido pelo QR code abre uma conta nova.
 */
export async function closeTab(
  deps: Deps,
  ctx: RequestContext,
  input: { tabId: string; version: number },
): Promise<Result<void>> {
  if (!isId(input.tabId)) return err("NOT_FOUND");
  const allowed = await authorize(deps, ctx, "tab.pay", TAB_ENTITY, input.tabId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const tab = await repos.tabs.lock(input.tabId);
    if (!tab) return err("NOT_FOUND");
    if (tab.status !== "OPEN") return err("TAB_CLOSED");
    if (tab.version !== input.version) return err("STALE_RECORD");
    const { orders, totals } = await currentTotals(repos, tab);
    const allowedToClose = checkClose(totals, orders);
    if (!allowedToClose.ok) return allowedToClose;

    const audit = auditStamp(deps, ctx);
    const { timezone } = await repos.orderingSettings.get();
    await repos.tabs.close(
      tab.id,
      {
        subtotal: totals.subtotal,
        serviceCharge: totals.serviceCharge,
        total: totals.total,
        closedDay: businessDay(audit.at, timezone),
      },
      audit,
    );
    await repos.menuAccesses.endOpenForTable(tab.tableId, audit.at, "TAB_CLOSED");
    await repos.tabs.addEvent({
      id: deps.ids.next(),
      tabId: tab.id,
      kind: "CLOSED",
      details: {
        subtotal: totals.subtotal.toFixed(2),
        serviceCharge: totals.serviceCharge.toFixed(2),
        total: totals.total.toFixed(2),
        paid: totals.paid.toFixed(2),
      },
      userId: ctx.userId,
      at: audit.at,
    });
    await repos.audit.record({
      entity: TAB_ENTITY,
      entityId: tab.id,
      action: "UPDATE",
      changes: { status: ["OPEN", "CLOSED"] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

export type ClosedTabsReport = {
  tabs: ClosedTabRow[];
  summary: { byMethod: { method: PaymentMethod; amount: Decimal }[]; serviceCharge: Decimal; total: Decimal };
};

/**
 * Contas fechadas por dia local do fechamento (até 31 dias) e mesa, a mais recente primeiro, com o
 * resumo por forma de pagamento (US6).
 */
export async function listTabs(
  deps: Deps,
  ctx: RequestContext,
  input: { from: string; to: string; tableId?: string },
): Promise<Result<ClosedTabsReport>> {
  const allowed = await authorize(deps, ctx, "tab.history", TAB_ENTITY);
  if (!allowed.ok) return allowed;
  const period = checkPeriod(input.from, input.to);
  if (!period.ok) return period;
  if (input.tableId && !isId(input.tableId)) return err("VALIDATION", "tableId");
  const filter = { fromDay: input.from, toDay: input.to, tableId: input.tableId };
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const tabs = await repos.tabs.listClosed(filter);
    const paid = await repos.tabs.paidByMethod(filter);
    return ok({ tabs, summary: closedSummary(tabs, paid) });
  });
}

/**
 * Reabre uma conta fechada (só gerente, com motivo): volta aberta com os pagamentos, e o histórico
 * guarda os valores de antes. A mesa que já abriu outra conta precisa fechar a nova antes.
 */
export async function reopenTab(
  deps: Deps,
  ctx: RequestContext,
  input: { tabId: string; reason: string; version: number },
): Promise<Result<void>> {
  if (!isId(input.tabId)) return err("NOT_FOUND");
  const allowed = await authorize(deps, ctx, "tab.reopen", TAB_ENTITY, input.tabId);
  if (!allowed.ok) return allowed;
  const reason = checkReopenReason(input.reason);
  if (!reason.ok) return reason;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const tab = await repos.tabs.lock(input.tabId);
    if (!tab) return err("NOT_FOUND");
    if (tab.status !== "CLOSED") return err("TAB_NOT_CLOSED");
    if (tab.version !== input.version) return err("STALE_RECORD");
    const audit = auditStamp(deps, ctx);
    const reopened = await repos.tabs.reopen(tab.id, audit);
    if (!reopened.ok) return reopened;
    const before = tab.closedTotals;
    await repos.tabs.addEvent({
      id: deps.ids.next(),
      tabId: tab.id,
      kind: "REOPENED",
      reason: reason.value,
      details: {
        previous: {
          subtotal: before?.subtotal.toFixed(2) ?? null,
          serviceCharge: before?.serviceCharge.toFixed(2) ?? null,
          total: before?.total.toFixed(2) ?? null,
          closedAt: tab.closedAt?.toISOString() ?? null,
          closedByName: tab.closedByName,
        },
      },
      userId: ctx.userId,
      at: audit.at,
    });
    await repos.audit.record({
      entity: TAB_ENTITY,
      entityId: tab.id,
      action: "UPDATE",
      changes: { status: ["CLOSED", "OPEN"], reason: reason.value },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}
