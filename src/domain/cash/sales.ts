import { d, type Decimal } from "../shared/decimal";

/** Vendas por produto (spec 014, US6-3). */

const HUNDRED = d(100);

/**
 * Ordena do maior valor para o menor (empate pelo nome) e diz a parte de cada linha no total, em %
 * com 1 casa. O valor não é arredondado; só a parte. O que sobra do arredondamento vai para a
 * primeira linha, para as partes somarem 100,0%. Total zero: todas as partes são zero.
 */
export function salesShares<T extends { name: string; amount: Decimal }>(
  rows: readonly T[],
): (T & { share: Decimal })[] {
  const sorted = [...rows].sort(
    (a, b) => b.amount.comparedTo(a.amount) || a.name.localeCompare(b.name, "pt-BR"),
  );
  const total = sorted.reduce((sum, r) => sum.plus(r.amount), d(0));
  if (total.isZero()) return sorted.map((r) => ({ ...r, share: d(0) }));
  const shares = sorted.map((r) => r.amount.times(HUNDRED).div(total).toDecimalPlaces(1));
  const rest = HUNDRED.minus(shares.reduce((sum, s) => sum.plus(s), d(0)));
  return sorted.map((r, i) => ({ ...r, share: i === 0 ? shares[i]!.plus(rest) : shares[i]! }));
}
