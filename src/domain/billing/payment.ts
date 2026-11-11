import type { Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";

/** Formas de pagamento, lista fechada (spec 011, FR-003). */
export const PAYMENT_METHODS = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  DEBIT_CARD: "Cartão de débito",
  CREDIT_CARD: "Cartão de crédito",
  OTHER: "Outro",
};

export const isPaymentMethod = (v: unknown): v is PaymentMethod =>
  (PAYMENT_METHODS as readonly unknown[]).includes(v);

/** `received`: o que o cliente entregou em dinheiro; só existe no dinheiro. */
export type PaymentInput = { method: PaymentMethod; amount: Decimal; received: Decimal | null };
export type CheckedPayment = PaymentInput & { change: Decimal | null };

const isMoney = (v: Decimal) => v.gt(0) && v.decimalPlaces() <= 2;

/**
 * O valor é o que entra na conta: maior que zero, com até 2 casas e nunca acima do que falta.
 * Em dinheiro o recebido pode ser maior (troco = recebido − valor); sem recebido, é o próprio valor.
 */
export function checkPayment(input: PaymentInput, remaining: Decimal): Result<CheckedPayment> {
  if (!isPaymentMethod(input.method)) return err("VALIDATION", "method");
  if (!isMoney(input.amount)) return err("INVALID_AMOUNT", "amount");
  if (input.received !== null && input.method !== "CASH") return err("VALIDATION", "received");
  if (input.amount.gt(remaining))
    return err("PAYMENT_EXCEEDS_REMAINING", "amount", { remaining: remaining.toFixed(2) });
  if (input.method !== "CASH") return ok({ ...input, received: null, change: null });
  const received = input.received ?? input.amount;
  if (!isMoney(received)) return err("INVALID_AMOUNT", "received");
  if (received.lt(input.amount)) return err("RECEIVED_TOO_LOW", "received");
  return ok({ method: input.method, amount: input.amount, received, change: received.minus(input.amount) });
}
