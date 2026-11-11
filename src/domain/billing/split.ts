import { Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";

export const MIN_PEOPLE = 2;
export const MAX_PEOPLE = 20;

/**
 * Divide o que falta por N pessoas (spec 011, FR-005): partes em centavos, os centavos que sobram
 * na primeira parte, e a soma é sempre o que falta. Não grava nada; só sugere valores.
 */
export function splitEvenly(remaining: Decimal, people: number): Result<Decimal[]> {
  if (!Number.isInteger(people) || people < MIN_PEOPLE || people > MAX_PEOPLE)
    return err("INVALID_PEOPLE", "people");
  if (remaining.lt(0) || remaining.decimalPlaces() > 2) return err("INVALID_AMOUNT", "remaining");
  const part = remaining.dividedBy(people).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const first = remaining.minus(part.times(people - 1));
  return ok([first, ...Array.from({ length: people - 1 }, () => part)]);
}
