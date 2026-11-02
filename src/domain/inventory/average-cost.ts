import type { Decimal } from "../shared/decimal";

type Stock = { qty: Decimal; avgCost: Decimal | null };
type Purchase = { qty: Decimal; unitCost: Decimal };

/**
 * Custo médio ponderado depois de uma compra:
 * (saldo × médio + qtd × custo) ÷ (saldo + qtd). Sem saldo positivo, vale o custo da compra.
 */
export function applyPurchase(current: Stock, purchase: Purchase): Decimal {
  if (current.qty.lte(0) || current.avgCost === null) return purchase.unitCost;
  return current.qty
    .times(current.avgCost)
    .plus(purchase.qty.times(purchase.unitCost))
    .dividedBy(current.qty.plus(purchase.qty));
}

/** Desfaz uma compra (estorno). Se não sobra saldo, ou a conta daria negativo, mantém a média. */
export function removePurchase(current: { qty: Decimal; avgCost: Decimal }, purchase: Purchase): Decimal {
  const remaining = current.qty.minus(purchase.qty);
  if (remaining.lte(0)) return current.avgCost;
  const avg = current.qty
    .times(current.avgCost)
    .minus(purchase.qty.times(purchase.unitCost))
    .dividedBy(remaining);
  return avg.lt(0) ? current.avgCost : avg;
}
