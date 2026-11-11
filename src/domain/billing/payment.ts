import type { Decimal } from "../shared/decimal";
import { err, type Result } from "../shared/result";

/** Esqueleto (vermelho): a regra vem no próximo commit. */
export const PAYMENT_METHODS = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "",
  PIX: "",
  DEBIT_CARD: "",
  CREDIT_CARD: "",
  OTHER: "",
};

export type PaymentInput = { method: PaymentMethod; amount: Decimal; received: Decimal | null };
export type CheckedPayment = PaymentInput & { change: Decimal | null };

export function checkPayment(_input: PaymentInput, _remaining: Decimal): Result<CheckedPayment> {
  return err("VALIDATION");
}
