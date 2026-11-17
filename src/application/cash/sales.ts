import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize } from "../shared";
import { checkPeriod } from "../ordering/orders";
import { CASH_ENTITY } from "./shared";
import { sessionRows, type CashSessionRow } from "./reports";
import { PAYMENT_METHODS } from "@/domain/billing/payment";
import { salesShares } from "@/domain/cash/sales";
import { totalOf, type MethodAmount } from "@/domain/cash/summary";
import { d, type Decimal } from "@/domain/shared/decimal";
import { ok, type Result } from "@/domain/shared/result";

/** Relatório de vendas por período (spec 014, US6 e FR-007). */

export type SalesReport = {
  /** Recebido por forma: soma dos turnos abertos no período (a conta de cada relatório de turno). */
  byMethod: MethodAmount[];
  /** Pagamentos de turnos anteriores tirados nos turnos do período; só as formas que tiveram. */
  removedFromOtherSessions: MethodAmount[];
  received: Decimal;
  /** Taxa de serviço das contas fechadas no período. */
  serviceCharge: Decimal;
  products: { recipeId: string; name: string; quantity: number; amount: Decimal; share: Decimal }[];
  productsTotal: Decimal;
  addons: { addonId: string; name: string; times: number; amount: Decimal }[];
  sessions: CashSessionRow[];
  /** Soma das diferenças dos turnos fechados do período. */
  differenceTotal: Decimal;
  pendingOrders: number;
  timezone: string;
};

/** Soma as formas de vários turnos; toda forma aparece, na ordem da lista de formas. */
const sumByMethod = (rows: readonly (readonly MethodAmount[])[]): MethodAmount[] =>
  PAYMENT_METHODS.map((method) => ({
    method,
    amount: rows
      .flat()
      .filter((r) => r.method === method)
      .reduce((s, r) => s.plus(r.amount), d(0)),
  }));

/** Só o gerente (FR-008). Período de até 31 dias do restaurante. */
export async function salesReport(
  deps: Deps,
  ctx: RequestContext,
  input: { from: string; to: string },
): Promise<Result<SalesReport>> {
  const allowed = await authorize(deps, ctx, "sales.report", CASH_ENTITY);
  if (!allowed.ok) return allowed;
  const period = checkPeriod(input.from, input.to);
  if (!period.ok) return period;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const sessions = await sessionRows(repos, input.from, input.to);
    const sales = await repos.sales.ofPeriod(input.from, input.to);
    const { timezone } = await repos.orderingSettings.get();
    const byMethod = sumByMethod(sessions.map((s) => s.receivedByMethod));
    const products = salesShares(sales.products);
    return ok({
      byMethod,
      removedFromOtherSessions: sumByMethod(sessions.map((s) => s.removedFromOtherSessions)).filter(
        (r) => !r.amount.isZero(),
      ),
      received: totalOf(byMethod),
      serviceCharge: sales.serviceCharge,
      products,
      productsTotal: products.reduce((s, p) => s.plus(p.amount), d(0)),
      addons: sales.addons,
      sessions,
      differenceTotal: sessions.reduce((s, x) => s.plus(x.difference ?? 0), d(0)),
      pendingOrders: sales.pendingOrders,
      timezone,
    });
  });
}
