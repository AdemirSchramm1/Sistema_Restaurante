import { d, type Decimal } from "../shared/decimal";
import { err, type Result } from "../shared/result";
import type { OrderStatus } from "../ordering/order";

/** Esqueleto (vermelho): a regra vem no próximo commit. */
export type TabOrder = { status: OrderStatus; total: Decimal };
export type TabPayment = { amount: Decimal; removed: boolean };
export type TabTotals = {
  subtotal: Decimal;
  serviceCharge: Decimal;
  total: Decimal;
  paid: Decimal;
  remaining: Decimal;
};
export type CloseBlocker = "REMAINING_NOT_ZERO" | "PENDING_ORDERS";

export const isPendingOrder = (_status: OrderStatus): boolean => false;

export function tabTotals(_input: {
  orders: readonly TabOrder[];
  payments: readonly TabPayment[];
  serviceRate: Decimal | null;
  serviceWaived: boolean;
}): TabTotals {
  const z = d(-1);
  return { subtotal: z, serviceCharge: z, total: z, paid: z, remaining: z };
}

export function closeBlockers(_totals: TabTotals, _orders: readonly { status: OrderStatus }[]): CloseBlocker[] {
  return [];
}

export function checkClose(_totals: TabTotals, _orders: readonly { status: OrderStatus }[]): Result<void> {
  return err("VALIDATION");
}
