import { d, Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";

/**
 * Reposição (docs/produto/estoque/08-ciclo-operacional.md#planejamento, spec 006).
 * ES = CMD × C × margem · PP = CMD × LT + ES · Par = CMD × C + ES
 * Pedir = Par − (saldo − CMD × LT) − em trânsito (mínimo 0).
 */

const QTY_SCALE = 4;
/** Maior valor que cabe em numeric(14,4). */
const QTY_MAX = d("9999999999.9999");
/** Margem de segurança padrão da sugestão (FR-005). */
export const DEFAULT_SAFETY_MARGIN = d("0.2");
/** Janela de consumo da sugestão, em dias (FR-005). */
export const USAGE_WINDOW_DAYS = 30;

const ZERO = d(0);
const max0 = (v: Decimal) => (v.lt(0) ? ZERO : v);

export type ReorderInput = {
  averageDailyUsage: Decimal;
  leadTimeDays: number;
  reorderCycleDays: Decimal;
  safetyMargin: Decimal;
  currentBalance: Decimal;
  inTransit: Decimal;
};

export function calculateReorder(p: ReorderInput) {
  const safetyStock = p.averageDailyUsage.mul(p.reorderCycleDays).mul(p.safetyMargin);
  const reorderPoint = p.averageDailyUsage.mul(p.leadTimeDays).add(safetyStock);
  const parLevel = p.averageDailyUsage.mul(p.reorderCycleDays).add(safetyStock);
  const quantity = orderQuantity({
    parLevel,
    balance: p.currentBalance,
    averageDailyUsage: p.averageDailyUsage,
    leadTimeDays: p.leadTimeDays,
    inTransit: p.inTransit,
  });
  return { safetyStock, reorderPoint, parLevel, orderQuantity: quantity };
}

/** Pedir = Par − (saldo − CMD × LT) − em trânsito, nunca negativo. */
export function orderQuantity(p: {
  parLevel: Decimal;
  balance: Decimal;
  averageDailyUsage: Decimal;
  leadTimeDays: number;
  inTransit?: Decimal;
}): Decimal {
  const atArrival = p.balance.sub(p.averageDailyUsage.mul(p.leadTimeDays));
  return max0(p.parLevel.sub(atArrival).sub(p.inTransit ?? ZERO));
}

/** Arredonda para cima em embalagens inteiras: 18 kg em caixa de 5 kg = 4 caixas (20 kg). */
export function roundUpToPackage(quantity: Decimal, packageQuantity: Decimal) {
  const packages = quantity.div(packageQuantity).toDecimalPlaces(0, Decimal.ROUND_CEIL);
  return { packages, quantity: packages.mul(packageQuantity) };
}

/** Item no ponto (FR-003): ativo, com ponto definido e saldo ≤ ponto. */
export function isAtReorderPoint(i: { active: boolean; balance: Decimal; reorderPoint: Decimal | null }): boolean {
  return i.active && i.reorderPoint !== null && i.balance.lte(i.reorderPoint);
}

export type ReorderLevels = { reorderPoint: Decimal | null; parLevel: Decimal | null };

const validQty = (q: Decimal) => q.gte(0) && q.lte(QTY_MAX) && q.decimalPlaces() <= QTY_SCALE;

/** Campos do aviso (FR-001): ponto ≥ 0; "comprar até" só com ponto e maior que ele. */
export function validateReorderLevels(l: ReorderLevels): Result<void> {
  if (l.reorderPoint !== null && !validQty(l.reorderPoint)) return err("INVALID_QUANTITY", "reorderPoint");
  if (l.parLevel !== null && !validQty(l.parLevel)) return err("INVALID_QUANTITY", "parLevel");
  if (l.parLevel !== null && (l.reorderPoint === null || l.parLevel.lte(l.reorderPoint)))
    return err("INVALID_REORDER_LEVELS", "parLevel");
  return ok(undefined);
}

/** Ciclo de reposição pelos dias de entrega na semana; sem dias, uma vez por semana. */
export function cycleDaysFromDeliveryDays(count: number): Decimal {
  return count > 0 ? d(7).div(count) : d(7);
}

export function averageDailyUsage(consumed: Decimal, days: number): Decimal {
  return consumed.div(days);
}

/**
 * Sugestão de ponto e "comprar até" pelo consumo (FR-005). Sem fornecedor preferido: prazo de 1 dia
 * e ciclo de 7 dias. Sem consumo, não há sugestão.
 */
export function suggestReorderLevels(p: {
  consumed: Decimal;
  periodDays: number;
  leadTimeDays: number | null;
  deliveryDaysCount: number;
  safetyMargin?: Decimal;
}) {
  if (p.consumed.lte(0)) return null;
  const cmd = averageDailyUsage(p.consumed, p.periodDays);
  const r = calculateReorder({
    averageDailyUsage: cmd,
    leadTimeDays: p.leadTimeDays ?? 1,
    reorderCycleDays: cycleDaysFromDeliveryDays(p.deliveryDaysCount),
    safetyMargin: p.safetyMargin ?? DEFAULT_SAFETY_MARGIN,
    currentBalance: ZERO,
    inTransit: ZERO,
  });
  return { averageDailyUsage: cmd, reorderPoint: r.reorderPoint, parLevel: r.parLevel };
}

export type OrderPlan = {
  /** Na medida do item; `null` sem "comprar até". */
  quantity: Decimal | null;
  /** Em embalagens inteiras, quando há embalagem e algo a comprar. */
  packages: { count: Decimal; label: string; total: Decimal } | null;
};

/** Quanto comprar para a lista "Repor" (FR-006). Não há pedido em trânsito. */
export function planOrder(p: {
  balance: Decimal;
  parLevel: Decimal | null;
  averageDailyUsage: Decimal;
  leadTimeDays: number;
  package: { label: string; quantity: Decimal } | null;
}): OrderPlan {
  if (p.parLevel === null) return { quantity: null, packages: null };
  const quantity = orderQuantity({ ...p, parLevel: p.parLevel });
  if (!p.package || quantity.isZero()) return { quantity, packages: null };
  const r = roundUpToPackage(quantity, p.package.quantity);
  return { quantity, packages: { count: r.packages, label: p.package.label, total: r.quantity } };
}
