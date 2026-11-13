import { d, formatBrl, type Decimal } from "@/domain/shared/decimal";

const dec = (v: Decimal | string) => (typeof v === "string" ? d(v) : v);

/** "R$ 34,00". Aceita o texto que vem do servidor ("34.00"). */
export const brl = (v: Decimal | string) => formatBrl(dec(v));

/** "R$ 3,00" ou "Grátis" (spec 010: adicional com preço zero). */
export const priceOrFree = (v: Decimal | string) => (dec(v).isZero() ? "Grátis" : brl(v));
