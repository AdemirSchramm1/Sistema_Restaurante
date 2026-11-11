import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import type { Decimal } from "@/domain/shared/decimal";
import { err, type Result } from "@/domain/shared/result";

/** Esqueleto (vermelho). */
export async function getServiceChargeSettings(
  _deps: Deps,
  _ctx: RequestContext,
): Promise<Result<{ rate: Decimal | null; version: number }>> {
  return err("NOT_FOUND");
}

export async function setServiceChargeRate(
  _deps: Deps,
  _ctx: RequestContext,
  _input: { rate: Decimal | null; version: number },
): Promise<Result<void>> {
  return err("NOT_FOUND");
}
