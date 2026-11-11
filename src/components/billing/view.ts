import type { TabView } from "@/application/billing/tabs";
import type { TabDetailView } from "./tab-detail";

/** Conta do caso de uso para a tela: dinheiro em string com 2 casas, datas em ISO. */
export function tabDetailView(t: TabView): TabDetailView {
  return {
    id: t.id,
    tableName: t.tableName,
    status: t.status,
    openedAt: t.openedAt.toISOString(),
    closedAt: t.closedAt?.toISOString() ?? null,
    closedByName: t.closedByName,
    orders: t.orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      cancelReason: o.cancelReason,
      cancelNote: o.cancelNote,
      total: o.total.toFixed(2),
      lines: o.lines.map((l) => ({ ...l, unitPrice: l.unitPrice.toFixed(2) })),
    })),
    subtotal: t.subtotal.toFixed(2),
    serviceRate: t.serviceRate?.toString() ?? null,
    serviceWaived: t.serviceWaived,
    serviceCharge: t.serviceCharge.toFixed(2),
    total: t.total.toFixed(2),
    paid: t.paid.toFixed(2),
    remaining: t.remaining.toFixed(2),
    pendingOrders: t.pendingOrders,
    blockers: t.blockers,
    payments: t.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: p.amount.toFixed(2),
      received: p.received?.toFixed(2) ?? null,
      change: p.change?.toFixed(2) ?? null,
      at: p.at.toISOString(),
      byName: p.byName,
      removedAt: p.removedAt?.toISOString() ?? null,
      removedByName: p.removedByName,
    })),
    events: t.events.map((e) => ({ ...e, at: e.at.toISOString() })),
  };
}
