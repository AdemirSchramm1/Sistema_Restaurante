import type { SalesReport } from "@/application/cash/sales";
import { sessionRowView } from "@/components/cash/view";
import type { SalesReportView } from "./sales-report";

const money = (v: { toFixed(n: number): string }) => v.toFixed(2);

/** Relatório de vendas do caso de uso para a tela (spec 014, US6). */
export const salesReportView = (r: SalesReport, from: string, to: string): SalesReportView => ({
  from,
  to,
  timezone: r.timezone,
  byMethod: r.byMethod.map((m) => ({ method: m.method, amount: money(m.amount) })),
  removedFromOtherSessions: r.removedFromOtherSessions.map((m) => ({
    method: m.method,
    amount: money(m.amount),
  })),
  received: money(r.received),
  serviceCharge: money(r.serviceCharge),
  products: r.products.map((p) => ({ ...p, amount: money(p.amount), share: p.share.toFixed(1) })),
  productsTotal: money(r.productsTotal),
  addons: r.addons.map((a) => ({ ...a, amount: money(a.amount) })),
  sessions: r.sessions.map(sessionRowView),
  differenceTotal: money(r.differenceTotal),
  pendingOrders: r.pendingOrders,
});
