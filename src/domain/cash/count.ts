import { d, type Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";
import { isCashAmount } from "./session";

/** Contagem do dinheiro da gaveta (spec 014, US4-1). */

/** Cédulas e moedas do real, da maior para a menor. */
export const DENOMINATIONS = [
  "200",
  "100",
  "50",
  "20",
  "10",
  "5",
  "2",
  "1",
  "0.50",
  "0.25",
  "0.10",
  "0.05",
] as const;
export type Denomination = (typeof DENOMINATIONS)[number];
export type Denominations = Partial<Record<Denomination, number>>;

export const DENOMINATION_LABELS = Object.fromEntries(
  DENOMINATIONS.map((v) => [v, `R$ ${v.replace(".", ",")}`]),
) as Record<Denomination, string>;

/** Σ quantidade × valor, sem ponto flutuante. */
export function sumDenominations(denominations: Denominations): Decimal {
  return DENOMINATIONS.reduce((total, v) => total.plus(d(v).times(denominations[v] ?? 0)), d(0));
}

const isDenomination = (v: string): v is Denomination => (DENOMINATIONS as readonly string[]).includes(v);

/** Quantidade de cédulas: inteiro de zero para cima. */
const isQuantity = (q: unknown): q is number => Number.isInteger(q) && (q as number) >= 0;

/**
 * Contado: zero ou mais, com até 2 casas. Com a calculadora, cada chave é uma cédula ou moeda da
 * lista, cada quantidade é um inteiro de zero para cima e a soma é o contado. Quantidades zero não
 * são guardadas; calculadora vazia vale como total digitado.
 */
export function checkCount(input: {
  counted: Decimal;
  denominations: Record<string, unknown> | null;
}): Result<{ counted: Decimal; denominations: Denominations | null }> {
  if (!isCashAmount(input.counted)) return err("INVALID_AMOUNT", "counted");
  const used: Denominations = {};
  for (const [value, quantity] of Object.entries(input.denominations ?? {})) {
    if (!isDenomination(value) || !isQuantity(quantity))
      return err("DENOMINATIONS_MISMATCH", "denominations");
    if (quantity > 0) used[value] = quantity;
  }
  if (!Object.keys(used).length) return ok({ counted: input.counted, denominations: null });
  if (!sumDenominations(used).equals(input.counted)) return err("DENOMINATIONS_MISMATCH", "denominations");
  return ok({ counted: input.counted, denominations: used });
}
