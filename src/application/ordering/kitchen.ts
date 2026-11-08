import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import type { OrderRecord } from "./ports";
import {
  checkCancel,
  checkTransition,
  isLate,
  type CancelReason,
  type OrderStatus,
} from "@/domain/ordering/order";
import type { Action } from "@/domain/access/permissions";
import { err, ok, type Result } from "@/domain/shared/result";

/** Cozinha e garçom (spec 009, US4). Cada mudança de situação grava o evento com quem e quando. */

const ENTITY = "order";

export type OrderLineSummary = { quantity: number; productName: string; changes: string[] };

export type KitchenOrder = {
  id: string;
  number: number;
  tableName: string;
  submittedAt: Date;
  status: OrderStatus;
  late: boolean;
  version: number;
  lines: OrderLineSummary[];
};

export type ReadyOrder = {
  id: string;
  number: number;
  tableName: string;
  readyAt: Date;
  version: number;
  lines: OrderLineSummary[];
};

const lines = (o: OrderRecord): OrderLineSummary[] =>
  o.lines.map(({ quantity, productName, changes }) => ({ quantity, productName, changes }));

/** Pedidos recebidos, em preparo e prontos, mais antigo primeiro. */
export async function listKitchenOrders(
  deps: Deps,
  ctx: RequestContext,
): Promise<Result<{ orders: KitchenOrder[]; serverNow: string }>> {
  const allowed = await authorize(deps, ctx, "order.kitchen", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const now = deps.clock.now();
    const rows = await repos.orders.listByStatus(["RECEIVED", "PREPARING", "READY"]);
    return ok({
      serverNow: now.toISOString(),
      orders: rows.map((o) => ({
        id: o.id,
        number: o.number,
        tableName: o.tableName,
        submittedAt: o.submittedAt,
        status: o.status,
        late: isLate(o.status, o.submittedAt, now),
        version: o.version,
        lines: lines(o),
      })),
    });
  });
}

/** Pedidos prontos para levar, mais antigo primeiro. */
export async function listReadyOrders(deps: Deps, ctx: RequestContext): Promise<Result<ReadyOrder[]>> {
  const allowed = await authorize(deps, ctx, "order.deliver", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const rows = await repos.orders.listByStatus(["READY"]);
    return ok(
      rows
        .sort((a, b) => a.statusChangedAt.getTime() - b.statusChangedAt.getTime())
        .map((o) => ({
          id: o.id,
          number: o.number,
          tableName: o.tableName,
          readyAt: o.statusChangedAt,
          version: o.version,
          lines: lines(o),
        })),
    );
  });
}

async function move(
  deps: Deps,
  ctx: RequestContext,
  action: Action,
  input: { id: string; to: OrderStatus; version: number },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, action, ENTITY, input.id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.orders.get(input.id);
    if (!current) return err("NOT_FOUND");
    if (current.version !== input.version) return err("STALE_RECORD");
    const t = checkTransition(current.status, input.to);
    if (!t.ok) return t;
    return repos.orders.changeStatus(
      input.id,
      { from: current.status, to: input.to, reason: null, note: null },
      input.version,
      auditStamp(deps, ctx),
    );
  });
}

/** "Em preparo" e "Pronto" (cozinha). */
export async function advanceOrderStatus(
  deps: Deps,
  ctx: RequestContext,
  input: { id: string; to: OrderStatus; version: number },
): Promise<Result<void>> {
  if (input.to !== "PREPARING" && input.to !== "READY") {
    const allowed = await authorize(deps, ctx, "order.kitchen", ENTITY, input.id);
    if (!allowed.ok) return allowed;
    return err("INVALID_ORDER_TRANSITION", undefined, { to: input.to });
  }
  return move(deps, ctx, "order.kitchen", input);
}

/** "Entregue" (garçom). */
export async function markDelivered(
  deps: Deps,
  ctx: RequestContext,
  input: { id: string; version: number },
): Promise<Result<void>> {
  return move(deps, ctx, "order.deliver", { ...input, to: "DELIVERED" });
}

/** Cancela com motivo da lista; "Outro" pede texto de até 140. */
export async function cancelOrder(
  deps: Deps,
  ctx: RequestContext,
  input: { id: string; reason: CancelReason; note: string | null; version: number },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "order.cancel", ENTITY, input.id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.orders.get(input.id);
    if (!current) return err("NOT_FOUND");
    if (current.version !== input.version) return err("STALE_RECORD");
    const c = checkCancel(current.status, input.reason, input.note);
    if (!c.ok) return c;
    return repos.orders.changeStatus(
      input.id,
      { from: current.status, to: "CANCELLED", reason: c.value.reason, note: c.value.note },
      input.version,
      auditStamp(deps, ctx),
    );
  });
}
