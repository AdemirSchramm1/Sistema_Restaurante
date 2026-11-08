import { formatBrDecimal, type Decimal } from "@/domain/shared/decimal";

/** "R$ 3,00" ou "Grátis" (spec 010: adicional com preço zero). */
export const priceOrFree = (v: Decimal) => (v.isZero() ? "Grátis" : `R$ ${formatBrDecimal(v, { minPlaces: 2, maxPlaces: 2 })}`);

/** "R$ 34,00". */
export const brl = (v: Decimal) => `R$ ${formatBrDecimal(v, { minPlaces: 2, maxPlaces: 2 })}`;
