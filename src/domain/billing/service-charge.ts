import { d, type Decimal } from "../shared/decimal";
import { err, type Result } from "../shared/result";

/** Esqueleto (vermelho): a regra vem no próximo commit. */
export const DEFAULT_SERVICE_RATE = d(0);

export function serviceCharge(_subtotal: Decimal, _rate: Decimal | null, _waived: boolean): Decimal {
  return d(-1);
}

export function checkServiceRate(_rate: Decimal | null): Result<Decimal | null> {
  return err("VALIDATION");
}
