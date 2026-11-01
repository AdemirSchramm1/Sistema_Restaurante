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

/** Converte entre medidas da mesma família: 1,5 kg = 1500 g. Entre famílias diferentes, erro. */
export function convert(qty: Decimal, from: Unit, to: Unit): Result<Decimal> {
  if (from.dimension === to.dimension) return ok(qty.times(from.toBase).dividedBy(to.toBase));
  return err("UNIT_DIMENSION_MISMATCH", undefined, { from: from.code, to: to.code });
}

/** Embalagens → medida do item (20 caixas × 12 = 240 un). */
export function toStockUnit(purchaseQty: Decimal, purchaseFactor: Decimal): Result<Decimal> {
  if (purchaseFactor.lte(0)) return err("INVALID_FACTOR", "purchaseFactor");
  return ok(purchaseQty.times(purchaseFactor));
}

/** Medida do item → embalagens (120 un ÷ 240 = 0,5 caixa). */
export function fromStockUnit(stockQty: Decimal, purchaseFactor: Decimal): Result<Decimal> {
  if (purchaseFactor.lte(0)) return err("INVALID_FACTOR", "purchaseFactor");
  return ok(stockQty.dividedBy(purchaseFactor));
}
