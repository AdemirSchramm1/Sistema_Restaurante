import { d, type Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";

/** Limites do pedido (spec 009, casos-limite; research R10). */
export const MAX_LINE_QUANTITY = 20;
export const MAX_LINES = 30;
export const MAX_ORDERS_PER_ACCESS = 10;

export function validateLineQuantity(q: number): Result<void> {
  return Number.isInteger(q) && q >= 1 && q <= MAX_LINE_QUANTITY ? ok(undefined) : err("INVALID_QUANTITY", "quantity");
}

/** Quantidade de linhas e de pedidos já enviados pelo mesmo acesso. */
export function checkOrderShape(lineCount: number, ordersSoFar: number): Result<void> {
  if (ordersSoFar >= MAX_ORDERS_PER_ACCESS) return err("ACCESS_ORDER_LIMIT");
  if (lineCount < 1) return err("EMPTY_ORDER");
  if (lineCount > MAX_LINES) return err("TOO_MANY_LINES");
  return ok(undefined);
}

export const orderTotal = (lines: readonly { unitPrice: Decimal; quantity: number }[]): Decimal =>
  lines.reduce((s, l) => s.plus(l.unitPrice.times(l.quantity)), d(0));
