import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import type { OrderEventRecord } from "./ports";
import type { CancelReason, OrderStatus } from "@/domain/ordering/order";
import { err, ok, type Result } from "@/domain/shared/result";

/** Chave "Recebendo pedidos pelo QR code" e consulta de pedidos (spec 009, US6). */

export const MAX_PERIOD_DAYS = 31;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function getOrderingSettings(
  deps: Deps,
  ctx: RequestContext,
): Promise<Result<{ acceptingQrOrders: boolean; version: number }>> {
  const allowed = await authorize(deps, ctx, "ordering.toggle", "restaurant");
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const s = await repos.orderingSettings.get();
    return ok({ acceptingQrOrders: s.acceptingQrOrders, version: s.version });
  });
}

export async function setAcceptingQrOrders(
  deps: Deps,
  ctx: RequestContext,
  input: { accepting: boolean; version: number },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "ordering.toggle", "restaurant", ctx.restaurantId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.orderingSettings.get();
    const r = await repos.orderingSettings.setAcceptingQrOrders(
      input.accepting,
      input.version,
      auditStamp(deps, ctx),
    );
    if (!r.ok) return r;
    if (current.acceptingQrOrders !== input.accepting)
      await repos.audit.record({
        entity: "restaurant",
        entityId: ctx.restaurantId,
        action: "UPDATE",
        changes: { acceptingQrOrders: [current.acceptingQrOrders, input.accepting] },
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}

export type OrderListRow = {
  id: string;
  number: number;
  businessDay: string;
  tableName: string;
  submittedAt: Date;
  status: OrderStatus;
  total: string;
};

/** "2026-11-08" válido? */
const validDay = (v: string) => DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const daysBetween = (a: string, b: string) =>
  (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;

/** Período de consulta: dias locais "AAAA-MM-DD", início até o fim, até 31 dias (009 e 011). */
export function checkPeriod(from: string, to: string): Result<void> {
  if (!validDay(from) || !validDay(to)) return err("INVALID_PERIOD");
  const span = daysBetween(from, to);
  if (span < 0 || span >= MAX_PERIOD_DAYS) return err("INVALID_PERIOD");
  return ok(undefined);
}

/** Pedidos de um período de até 31 dias (dias locais), mais novo primeiro. */
export async function listOrders(
  deps: Deps,
  ctx: RequestContext,
  input: { from: string; to: string; tableId?: string; status?: OrderStatus },
): Promise<Result<OrderListRow[]>> {
  const allowed = await authorize(deps, ctx, "order.read", "order");
  if (!allowed.ok) return allowed;
  const period = checkPeriod(input.from, input.to);
  if (!period.ok) return period;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const rows = await repos.orders.list({
      fromDay: input.from,
      toDay: input.to,
      tableId: input.tableId,
      status: input.status,
    });
    return ok(
      rows.map((o) => ({
        id: o.id,
        number: o.number,
        businessDay: o.businessDay,
        tableName: o.tableName,
        submittedAt: o.submittedAt,
        status: o.status,
        total: o.total.toFixed(2),
      })),
    );
  });
}

export type OrderDetail = OrderListRow & {
  cancelReason: CancelReason | null;
  cancelNote: string | null;
  lines: { quantity: number; productName: string; unitPrice: string; changes: string[] }[];
  events: OrderEventRecord[];
};

export async function getOrder(deps: Deps, ctx: RequestContext, id: string): Promise<Result<OrderDetail>> {
  const allowed = await authorize(deps, ctx, "order.read", "order", id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const o = await repos.orders.get(id);
    if (!o) return err("NOT_FOUND");
    return ok({
      id: o.id,
      number: o.number,
      businessDay: o.businessDay,
      tableName: o.tableName,
      submittedAt: o.submittedAt,
      status: o.status,
      total: o.total.toFixed(2),
      cancelReason: o.cancelReason,
      cancelNote: o.cancelNote,
      lines: o.lines.map((l) => ({
        quantity: l.quantity,
        productName: l.productName,
        unitPrice: l.unitPrice.toFixed(2),
        changes: l.changes,
      })),
      events: await repos.orders.events(id),
    });
  });
}
