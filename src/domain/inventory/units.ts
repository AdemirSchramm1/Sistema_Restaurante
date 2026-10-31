import { d, type Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";

export type Dimension = "MASS" | "VOLUME" | "COUNT";
export type UnitCode = "g" | "kg" | "ml" | "l" | "un";
export type Unit = { code: UnitCode; dimension: Dimension; toBase: Decimal; label: string };

/** Catálogo global de unidades (igual ao seed da migração). */
export const UNITS: readonly Unit[] = [
  { code: "g", dimension: "MASS", toBase: d(1), label: "grama" },
  { code: "kg", dimension: "MASS", toBase: d(1000), label: "quilograma" },
  { code: "ml", dimension: "VOLUME", toBase: d(1), label: "mililitro" },
  { code: "l", dimension: "VOLUME", toBase: d(1000), label: "litro" },
  { code: "un", dimension: "COUNT", toBase: d(1), label: "unidade" },
];

export const unitByCode = (code: string): Unit | undefined => UNITS.find((u) => u.code === code);

/** "1 fromUnit = factor toUnit", válida só para um item (ex.: 1 un de ovo = 50 g). */
export type ItemConversion = { fromUnit: Unit; toUnit: Unit; factor: Decimal };

export function convert(
  qty: Decimal,
  from: Unit,
  to: Unit,
  conversions: readonly ItemConversion[] = [],
): Result<Decimal> {
  if (from.dimension === to.dimension) return ok(qty.times(from.toBase).dividedBy(to.toBase));
  for (const c of conversions) {
    if (c.fromUnit.dimension === from.dimension && c.toUnit.dimension === to.dimension) {
      const inConvFrom = qty.times(from.toBase).dividedBy(c.fromUnit.toBase);
      return ok(inConvFrom.times(c.factor).times(c.toUnit.toBase).dividedBy(to.toBase));
    }
    if (c.toUnit.dimension === from.dimension && c.fromUnit.dimension === to.dimension) {
      const inConvTo = qty.times(from.toBase).dividedBy(c.toUnit.toBase);
      return ok(inConvTo.dividedBy(c.factor).times(c.fromUnit.toBase).dividedBy(to.toBase));
    }
  }
  return err("UNIT_DIMENSION_MISMATCH", undefined, { from: from.code, to: to.code });
}

/** Unidade de compra → unidade de estoque (20 caixas × 12 = 240 un). */
export function toStockUnit(purchaseQty: Decimal, purchaseFactor: Decimal): Result<Decimal> {
  if (purchaseFactor.lte(0)) return err("INVALID_FACTOR", "purchaseFactor");
  return ok(purchaseQty.times(purchaseFactor));
}

/** Unidade de estoque → unidade de compra (120 un ÷ 240 = 0,5 caixa). */
export function fromStockUnit(stockQty: Decimal, purchaseFactor: Decimal): Result<Decimal> {
  if (purchaseFactor.lte(0)) return err("INVALID_FACTOR", "purchaseFactor");
  return ok(stockQty.dividedBy(purchaseFactor));
}
