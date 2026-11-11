import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import type { PaymentMethod } from "@/domain/billing/payment";
import type { Decimal } from "@/domain/shared/decimal";
import { err, type Result } from "@/domain/shared/result";

/** Esqueleto (vermelho). */
export async function addPayment(
  _deps: Deps,
  _ctx: RequestContext,
  _input: { tabId: string; method: PaymentMethod; amount: Decimal; received: Decimal | null; clientRequestId: string },
): Promise<Result<{ paymentId: string; change: Decimal | null }>> {
  return err("NOT_FOUND");
}

export async function removePayment(
  _deps: Deps,
  _ctx: RequestContext,
  _input: { tabId: string; paymentId: string },
): Promise<Result<void>> {
  return err("NOT_FOUND");
}
