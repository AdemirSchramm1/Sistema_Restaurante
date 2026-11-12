import DecimalJs from "decimal.js";
import { err, ok, type Result } from "./result";

/** Decimal exato usado em todo o domínio. Precisão alta para frações de conversão. */
export const Decimal = DecimalJs.clone({ precision: 40, rounding: DecimalJs.ROUND_HALF_UP });
export type Decimal = InstanceType<typeof Decimal>;

/** Cria um decimal. Aceita texto ou inteiro; número fracionário é recusado para evitar ponto flutuante. */
export function d(value: string | Decimal | bigint | number): Decimal {
  if (typeof value === "number" && !Number.isInteger(value)) {
    throw new TypeError(`Use texto para valores fracionários: d("${value}")`);
  }
  if (typeof value === "bigint") return new Decimal(value.toString());
  return new Decimal(value);
}

export const isDecimal = (v: unknown): v is Decimal => DecimalJs.isDecimal(v);

const BR_NUMBER = /^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/;

/** Lê "1.234,56" → 1234.56. */
export function parseBrDecimal(text: string): Result<Decimal> {
  const t = text.trim();
  if (!BR_NUMBER.test(t)) return err("INVALID_NUMBER");
  return ok(new Decimal(t.replace(/\./g, "").replace(",", ".")));
}

/** Formata com vírgula decimal e ponto de milhar. Arredonda meio para cima. */
export function formatBrDecimal(
  value: Decimal,
  opts: { minPlaces?: number; maxPlaces?: number } = {},
): string {
  const max = opts.maxPlaces ?? 4;
  const min = opts.minPlaces ?? 0;
  let s = value.toDecimalPlaces(max, Decimal.ROUND_HALF_UP).toFixed(max);
  if (max > min) {
    const [int, frac = ""] = s.split(".");
    let f = frac.replace(/0+$/, "");
    if (f.length < min) f = f.padEnd(min, "0");
    s = f ? `${int}.${f}` : int!;
  }
  const negative = s.startsWith("-");
  const [intPart, fracPart] = s.replace("-", "").split(".");
  const grouped = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const out = fracPart ? `${grouped},${fracPart}` : grouped;
  return negative && !/^[0.,]+$/.test(out) ? `-${out}` : out;
}

/** "R$ 1.234,50": 2 casas (até `maxPlaces` quando pedido), meio para cima. */
export function formatBrl(_value: Decimal, _opts: { maxPlaces?: number } = {}): string {
  return "";
}
