import { formatBrDecimal, formatBrl, type Decimal } from "@/domain/shared/decimal";

/** "R$ 8,50" (2 casas, meio para cima), sem sinal: o texto ao lado diz se é prejuízo. */
export const money = (v: Decimal) => formatBrl(v.abs());
/** "30,4%" (1 casa). */
export const percent = (v: Decimal) => `${formatBrDecimal(v, { maxPlaces: 1 })}%`;
/** "71%" (inteiro). */
export const wholePercent = (v: Decimal) => `${formatBrDecimal(v, { maxPlaces: 0 })}%`;
/** "1 produto" / "2 produtos". */
export const products = (n: number) => `${n} ${n === 1 ? "produto" : "produtos"}`;
