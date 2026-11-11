import { d, type Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";
import type { OrderStatus } from "../ordering/order";
import { serviceCharge } from "./service-charge";

/** O que a conta precisa saber de cada pedido e de cada pagamento (spec 011). */
export type TabOrder = { status: OrderStatus; total: Decimal };
export type TabPayment = { amount: Decimal; removed: boolean };
export type TabTotals = {
  subtotal: Decimal;
  serviceCharge: Decimal;
  total: Decimal;
  paid: Decimal;
  remaining: Decimal;
};
/** Por que a conta ainda não fecha; a tela mostra todos de uma vez. */
export type CloseBlocker = "REMAINING_NOT_ZERO" | "PENDING_ORDERS";

const PENDING: readonly OrderStatus[] = ["RECEIVED", "PREPARING", "READY"];

/** Pedido que ainda vai sair da cozinha ou chegar à mesa: entra no total, mas segura o fechamento. */
export const isPendingOrder = (status: OrderStatus): boolean => PENDING.includes(status);

const sum = (values: readonly Decimal[]) => values.reduce((a, b) => a.plus(b), d(0));

/**
 * Subtotal = pedidos não cancelados; total = subtotal + taxa; pago = pagamentos não tirados;
 * falta = total − pago (FR-002). Falta negativa só acontece se um pedido for cancelado depois de
 * pago: a conta não fecha até tirar o pagamento a mais.
 */
export function tabTotals(input: {
  orders: readonly TabOrder[];
  payments: readonly TabPayment[];
  serviceRate: Decimal | null;
  serviceWaived: boolean;
}): TabTotals {
  const subtotal = sum(input.orders.filter((o) => o.status !== "CANCELLED").map((o) => o.total));
  const charge = serviceCharge(subtotal, input.serviceRate, input.serviceWaived);
  const total = subtotal.plus(charge);
  const paid = sum(input.payments.filter((p) => !p.removed).map((p) => p.amount));
  return { subtotal, serviceCharge: charge, total, paid, remaining: total.minus(paid) };
}

const pendingCount = (orders: readonly { status: OrderStatus }[]) =>
  orders.filter((o) => isPendingOrder(o.status)).length;

/** Todos os motivos que seguram o fechamento (FR-004). */
export function closeBlockers(totals: TabTotals, orders: readonly { status: OrderStatus }[]): CloseBlocker[] {
  const out: CloseBlocker[] = [];
  if (!totals.remaining.isZero()) out.push("REMAINING_NOT_ZERO");
  if (pendingCount(orders) > 0) out.push("PENDING_ORDERS");
  return out;
}

/** Fecha só com falta R$ 0,00 e nenhum pedido em Recebido, Em preparo ou Pronto (FR-004). */
export function checkClose(totals: TabTotals, orders: readonly { status: OrderStatus }[]): Result<void> {
  if (!totals.remaining.isZero())
    return err("REMAINING_NOT_ZERO", undefined, { remaining: totals.remaining.toFixed(2) });
  const pending = pendingCount(orders);
  if (pending > 0) return err("PENDING_ORDERS", undefined, { pending });
  return ok(undefined);
}
