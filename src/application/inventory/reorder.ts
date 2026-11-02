import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import type { ReorderRow } from "./ports";
import {
  averageDailyUsage,
  cycleDaysFromDeliveryDays,
  isAtReorderPoint,
  planOrder,
  suggestReorderLevels,
  USAGE_WINDOW_DAYS,
  validateReorderLevels,
  type OrderPlan,
  type ReorderLevels,
} from "@/domain/inventory/reorder";
import { d, type Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

/** Aviso de reposição (specs/006-alerta-reposicao). */

const DAY_MS = 24 * 60 * 60 * 1000;
const str = (v: Decimal | null) => (v === null ? null : v.toString());

/** Janela de consumo da sugestão: últimos 30 dias até agora. */
function usageWindow(deps: Deps) {
  const to = deps.clock.now();
  return { from: new Date(to.getTime() - USAGE_WINDOW_DAYS * DAY_MS), to };
}

/** "Avisar quando chegar em" e "comprar até" do item (US1). */
export async function setReorderLevels(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  levels: ReorderLevels,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "item.reorder", "item", id);
  if (!allowed.ok) return allowed;
  const valid = validateReorderLevels(levels);
  if (!valid.ok) return valid;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const item = await repos.items.get(id);
    if (!item) return err("NOT_FOUND");
    const r = await repos.items.setReorderLevels(id, levels, version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    const before = { reorderPoint: str(item.reorderPoint), parLevel: str(item.parLevel) };
    const after = { reorderPoint: str(levels.reorderPoint), parLevel: str(levels.parLevel) };
    const changes: Record<string, [string | null, string | null]> = {};
    for (const k of ["reorderPoint", "parLevel"] as const)
      if (before[k] !== after[k]) changes[k] = [before[k], after[k]];
    if (Object.keys(changes).length)
      await repos.audit.record({
        entity: "item",
        entityId: id,
        action: "UPDATE",
        changes,
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}

export type ReorderAlert = {
  itemId: string;
  code: string;
  name: string;
  unit: ReorderRow["unit"];
  balance: Decimal;
  reorderPoint: Decimal;
  parLevel: Decimal | null;
  averageDailyUsage: Decimal;
  order: OrderPlan;
  supplier: { name: string; phone: string | null; leadTimeDays: number | null } | null;
};

/** Embalagem para arredondar a compra: a do fornecedor preferido, senão a do item. */
function packageOf(r: ReorderRow) {
  if (r.supplier?.packageLabel && r.supplier.packageQuantity)
    return { label: r.supplier.packageLabel, quantity: r.supplier.packageQuantity };
  if (r.purchaseUnitLabel && r.purchaseFactor) return { label: r.purchaseUnitLabel, quantity: r.purchaseFactor };
  return null;
}

/** Quem acabou primeiro; depois quem está mais longe do ponto (saldo ÷ ponto); depois o nome. */
function urgency(a: ReorderAlert, b: ReorderAlert) {
  const ra = a.balance.lte(0) ? d(-1) : a.balance.div(a.reorderPoint);
  const rb = b.balance.lte(0) ? d(-1) : b.balance.div(b.reorderPoint);
  return ra.cmp(rb) || a.name.localeCompare(b.name, "pt-BR");
}

/** Itens que chegaram no ponto, com quanto comprar e de quem (US2). */
export async function listReorderAlerts(deps: Deps, ctx: RequestContext): Promise<Result<ReorderAlert[]>> {
  const allowed = await authorize(deps, ctx, "catalog.read", "item");
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const rows = await repos.reports.reorderRows({ atPointOnly: true });
    if (!rows.length) return ok([]);
    const { from, to } = usageWindow(deps);
    const usage = new Map(
      (await repos.reports.outflowByItem(from, to, rows.map((r) => r.itemId))).map((o) => [o.itemId, o.quantity]),
    );
    const alerts = rows.map((r): ReorderAlert => {
      const cmd = averageDailyUsage(usage.get(r.itemId) ?? d(0), USAGE_WINDOW_DAYS);
      const leadTimeDays = r.supplier?.leadTimeDays ?? 1;
      return {
        itemId: r.itemId,
        code: r.code,
        name: r.name,
        unit: r.unit,
        balance: r.balance,
        reorderPoint: r.reorderPoint!,
        parLevel: r.parLevel,
        averageDailyUsage: cmd,
        order: planOrder({
          balance: r.balance,
          parLevel: r.parLevel,
          averageDailyUsage: cmd,
          leadTimeDays,
          package: packageOf(r),
        }),
        supplier: r.supplier
          ? { name: r.supplier.name, phone: r.supplier.phone, leadTimeDays: r.supplier.leadTimeDays }
          : null,
      };
    });
    return ok(alerts.sort(urgency));
  });
}

/** Número de itens no ponto, para o menu. */
export async function countReorderAlerts(deps: Deps, ctx: RequestContext): Promise<Result<number>> {
  const allowed = await authorize(deps, ctx, "catalog.read", "item");
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => ok(await repos.reports.countAtReorderPoint()));
}

export type ReorderView = {
  reorderPoint: Decimal | null;
  parLevel: Decimal | null;
  atReorderPoint: boolean;
  /** Sugestão pelo consumo dos últimos 30 dias; `null` sem consumo. */
  suggestion: {
    averageDailyUsage: Decimal;
    reorderPoint: Decimal;
    parLevel: Decimal;
    leadTimeDays: number;
    cycleDays: Decimal;
  } | null;
};

/** Quadro "Aviso de reposição" da página do item (US1, FR-005). */
export async function getReorderView(deps: Deps, ctx: RequestContext, itemId: string): Promise<Result<ReorderView>> {
  const allowed = await authorize(deps, ctx, "catalog.read", "item", itemId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const [row] = await repos.reports.reorderRows({ itemId });
    if (!row) return err("NOT_FOUND");
    const { from, to } = usageWindow(deps);
    const [usage] = await repos.reports.outflowByItem(from, to, [itemId]);
    const leadTimeDays = row.supplier?.leadTimeDays ?? 1;
    const deliveryDays = row.supplier?.deliveryDays.length ?? 0;
    const s = suggestReorderLevels({
      consumed: usage?.quantity ?? d(0),
      periodDays: USAGE_WINDOW_DAYS,
      leadTimeDays,
      deliveryDaysCount: deliveryDays,
    });
    return ok({
      reorderPoint: row.reorderPoint,
      parLevel: row.parLevel,
      atReorderPoint: isAtReorderPoint(row),
      suggestion: s && { ...s, leadTimeDays, cycleDays: cycleDaysFromDeliveryDays(deliveryDays) },
    });
  });
}
