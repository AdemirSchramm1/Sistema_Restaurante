import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize } from "../shared";
import { parsePeriod, rankOutflow } from "@/domain/inventory/stock-report";
import { reasonById } from "@/domain/inventory/movement-reasons";
import { MOVEMENT_TYPE_LABELS } from "@/domain/inventory/movement";
import { ok, type Result } from "@/domain/shared/result";
import type { Decimal } from "@/domain/shared/decimal";

export type StockReport = {
  period: ReturnType<typeof parsePeriod>;
  timezone: string;
  summary: { inflow: Decimal; outflow: Decimal; losses: Decimal; reorderCount: number };
  most: ReturnType<typeof rankOutflow>["most"];
  least: ReturnType<typeof rankOutflow>["least"];
  byReason: { label: string; value: Decimal }[];
  weeks: { weekStart: string; inflow: Decimal; outflow: Decimal }[];
};

/** Gráficos do estoque (spec 006, US3): o banco soma, o domínio ordena. */
export async function stockReport(
  deps: Deps,
  ctx: RequestContext,
  rawDays: string | undefined,
): Promise<Result<StockReport>> {
  const allowed = await authorize(deps, ctx, "catalog.read", "stock_report");
  if (!allowed.ok) return allowed;
  const period = parsePeriod(rawDays, deps.clock.now());
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const timezone = (await repos.restaurants.get())!.timezone;
    const { from, to } = period;
    const { most, least } = rankOutflow(await repos.reports.outflowByItem(from, to));
    const byReason = await repos.reports.outflowByReason(from, to);
    return ok({
      period,
      timezone,
      summary: {
        ...(await repos.reports.totals(from, to)),
        reorderCount: await repos.reports.countAtReorderPoint(),
      },
      most,
      least,
      byReason: byReason.map((r) => ({
        label:
          r.type === "SALE_RECIPE"
            ? MOVEMENT_TYPE_LABELS.SALE_RECIPE
            : // Fora a venda, toda saída tem motivo (stock_movements_reason no banco).
              reasonById(r.reasonId!)!.label,
        value: r.value,
      })),
      weeks: await repos.reports.weekly(from, to, timezone),
    });
  });
}
