import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { authorize } from "../shared";
import type { TabEventRecord, TabPaymentRecord, TabStatus } from "./ports";
import type { OrderLineView } from "../ordering/ports";
import type { CancelReason, OrderStatus } from "@/domain/ordering/order";
import { closeBlockers, isPendingOrder, tabTotals, type CloseBlocker } from "@/domain/billing/tab";
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
    payments: payments.map((p) => ({ amount: p.amount, removed: p.removedAt !== null })),
    serviceRate: tab.serviceRate,
    serviceWaived: tab.serviceWaived,
  });
  const blockers = tab.status === "OPEN" ? closeBlockers(totals, orders) : [];
  return ok({
    id: tab.id,
    tableId: tab.tableId,
    tableName: tab.tableName,
    restaurantName: (await repos.orderingSettings.get()).restaurantName,
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
  const allowed = await authorize(deps, ctx, "tab.read", TAB_ENTITY, id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, (repos) => loadTab(deps, repos, id));
}
