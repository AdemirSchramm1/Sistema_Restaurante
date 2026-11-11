import { d, Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";

/** Taxa com que todo restaurante começa: ligada, 10% (spec 011, FR-014). */
export const DEFAULT_SERVICE_RATE = d(10);
const MAX_RATE = d(20);

/**
 * Taxa = subtotal × porcentagem ÷ 100, em centavos, meio centavo para cima (FR-002).
 * Zero quando o restaurante desligou a taxa (`rate` nula) ou ela foi tirada da conta.
 */
export function serviceCharge(subtotal: Decimal, rate: Decimal | null, waived: boolean): Decimal {
  if (rate === null || waived) return d(0);
  return subtotal.times(rate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Porcentagem de 0 a 20, com até 2 casas; vazia desliga a taxa (FR-014). */
export function checkServiceRate(rate: Decimal | null): Result<Decimal | null> {
  if (rate === null) return ok(null);
  if (rate.lt(0) || rate.gt(MAX_RATE) || rate.decimalPlaces() > 2) return err("INVALID_RATE", "serviceChargeRate");
  return ok(rate);
}
