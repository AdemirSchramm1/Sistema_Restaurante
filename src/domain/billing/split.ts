import type { Decimal } from "../shared/decimal";
import { err, type Result } from "../shared/result";

/** Esqueleto (vermelho): a regra vem no próximo commit. */
export function splitEvenly(_remaining: Decimal, _people: number): Result<Decimal[]> {
  return err("VALIDATION");
}
