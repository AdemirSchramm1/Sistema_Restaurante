import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { recordOrderSale, reverseOrderSale } from "../inventory/sales";
import type { OrderRecord } from "./ports";
import {
  cancelScope,
  checkCancel,
  checkTransition,
  isLate,
  leftTheShelf,
  type CancelReason,
  type OrderSource,
  type OrderStatus,
} from "@/domain/ordering/order";
import { can, type Action } from "@/domain/access/permissions";
import { businessDay } from "@/domain/ordering/business-day";
import { isSoldOut } from "@/domain/ordering/menu";
import { err, ok, type Result } from "@/domain/shared/result";

/** Cozinha e garçom (spec 009, US4). Cada mudança de situação grava o evento com quem e quando. */

const ENTITY = "order";

export type OrderLineSummary = {
  quantity: number;
  productName: string;
  changes: string[];
  /** Observação para a cozinha (spec 015, FR-018). */
  kitchenNote: string | null;
};

/** De onde veio (spec 015, US2): "QR code" ou o nome de quem lançou. */
type Placed = { source: OrderSource; placedById: string | null; placedByName: string | null };

export type KitchenOrder = Placed & {
  id: string;
  number: number;
  tableName: string;
  submittedAt: Date;
  status: OrderStatus;
  late: boolean;
  version: number;
  lines: OrderLineSummary[];
};

export type ReadyOrder = Placed & {
  id: string;
  number: number;
  tableName: string;
  readyAt: Date;
  version: number;
  lines: OrderLineSummary[];
};

const lines = (o: OrderRecord): OrderLineSummary[] =>
  o.lines.map(({ quantity, productName, changes, kitchenNote }) => ({
    quantity,
    productName,
    changes,
    kitchenNote,
  }));

const placed = (o: OrderRecord): Placed => ({
  source: o.source,
  placedById: o.placedById,
  placedByName: o.placedByName,
});

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
        ...placed(o),
        submittedAt: o.submittedAt,
        status: o.status,
        late: isLate(o.status, o.submittedAt, now),
        version: o.version,
        lines: lines(o),
      })),
    });
  });
}

/** Pedidos prontos para levar, mais antigo primeiro; "Só os meus" (spec 015, US2-3). */
export async function listReadyOrders(
  deps: Deps,
  ctx: RequestContext,
  input: { onlyMine?: boolean } = {},
): Promise<Result<ReadyOrder[]>> {
  const allowed = await authorize(deps, ctx, "order.deliver", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const rows = await repos.orders.listByStatus(["READY"]);
    return ok(
      rows
        .filter((o) => !input.onlyMine || o.placedById === ctx.userId)
        .sort((a, b) => a.statusChangedAt.getTime() - b.statusChangedAt.getTime())
        .map((o) => ({
          id: o.id,
          number: o.number,
          tableName: o.tableName,
          ...placed(o),
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
    const changed = await repos.orders.changeStatus(
      input.id,
      { from: current.status, to: input.to, reason: null, note: null },
      input.version,
      auditStamp(deps, ctx),
    );
    if (!changed.ok) return changed;
    // Spec 011, FR-006: os ingredientes saem da prateleira quando a cozinha começa o preparo.
    if (input.to === "PREPARING") {
      const sold = await recordOrderSale(deps, ctx, repos, input.id);
      if (!sold.ok) return sold;
    }
    return ok(undefined);
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

/**
 * Cancela com motivo da lista; "Outro" pede texto de até 140. Depois do preparo (spec 011, US5),
 * estorna a venda e, com `ingredientsUsed`, lança a perda; a conta da mesa muda de versão porque o
 * total mudou. Quem só tem `order.cancel_own` (spec 015, R6) cancela o pedido que lançou, e só em
 * Recebido: nada saiu da prateleira, então `ingredientsUsed` não conta.
 */
export async function cancelOrder(
  deps: Deps,
  ctx: RequestContext,
  input: {
    id: string;
    reason: CancelReason;
    note: string | null;
    version: number;
    ingredientsUsed?: boolean;
  },
): Promise<Result<void>> {
  const who = {
    userId: ctx.userId,
    canCancel: can(ctx.roles, "order.cancel"),
    canCancelOwn: can(ctx.roles, "order.cancel_own"),
  };
  if (!who.canCancel && !who.canCancelOwn) {
    const denied = await authorize(deps, ctx, "order.cancel", ENTITY, input.id);
    if (!denied.ok) return denied;
  }
  const r = await deps.tenant(ctx.restaurantId, async (repos): Promise<Result<void>> => {
    const current = await repos.orders.get(input.id);
    if (!current) return err("NOT_FOUND");
    const scope = cancelScope(current, who);
    if (scope === "FORBIDDEN") return err("FORBIDDEN", undefined, { action: "order.cancel_own" });
    if (scope === "KITCHEN_STARTED") return err("KITCHEN_STARTED");
    if (current.version !== input.version) return err("STALE_RECORD");
    const own = scope === "OWN";
    const c = checkCancel(
      current.status,
      input.reason,
      input.note,
      own ? null : (input.ingredientsUsed ?? null),
    );
    if (!c.ok) return c;
    const audit = auditStamp(deps, ctx);
    const changed = await repos.orders.changeStatus(
      input.id,
      { from: current.status, to: "CANCELLED", reason: c.value.reason, note: c.value.note },
      input.version,
      audit,
    );
    if (!changed.ok) return changed;
    if (leftTheShelf(current.status)) {
      const back = await reverseOrderSale(deps, ctx, repos, input.id, input.ingredientsUsed === true);
      if (!back.ok) return back;
    }
    if (current.tabId) await repos.tabs.touch(current.tabId, audit);
    return ok(undefined);
  });
  if (!r.ok && r.error.code === "FORBIDDEN")
    // Pedido de outra pessoa ou do QR code: a tentativa fica na trilha (FR-014).
    await deps.tenant(ctx.restaurantId, async (repos) => {
      await repos.audit.record({
        entity: ENTITY,
        entityId: input.id,
        action: "DENIED",
        changes: { action: "order.cancel_own" },
        userId: ctx.userId,
        origin: ctx.origin,
      });
      return ok(undefined);
    });
  if (!r.ok && r.error.code === "STALE_RECORD" && !who.canCancel) {
    // Corrida com o Começar preparo: o garçom vê o motivo, não "alguém mudou".
    const now = await deps.tenant(ctx.restaurantId, async (repos) => ok(await repos.orders.get(input.id)));
    if (now.ok && now.value && cancelScope(now.value, who) === "KITCHEN_STARTED")
      return err("KITCHEN_STARTED");
  }
  return r;
}

/** Produtos vendidos (ativos e com preço) com o interruptor "Esgotado hoje" (spec 009, US5). */
export async function listDishesForKitchen(
  deps: Deps,
  ctx: RequestContext,
): Promise<Result<{ id: string; name: string; soldOut: boolean }[]>> {
  const allowed = await authorize(deps, ctx, "product.sold_out", "recipe");
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const today = businessDay(deps.clock.now(), (await repos.orderingSettings.get()).timezone);
    const rows = await repos.menu.products();
    return ok(
      rows
        .filter((r) => r.active && r.salePrice)
        .map((r) => ({ id: r.id, name: r.name, soldOut: isSoldOut(r.soldOutOn, today) })),
    );
  });
}

/**
 * "Esgotado hoje" guarda a data local de hoje: amanhã o produto volta sozinho. Sem trava otimista
 * (é um interruptor do dia; o último clique vale).
 */
export async function setProductSoldOut(
  deps: Deps,
  ctx: RequestContext,
  input: { recipeId: string; soldOut: boolean },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "product.sold_out", "recipe", input.recipeId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = (await repos.menu.products()).find((r) => r.id === input.recipeId);
    if (!current) {
      const any = await repos.recipes.get(input.recipeId);
      return any ? err("NOT_A_DISH") : err("NOT_FOUND");
    }
    const today = businessDay(deps.clock.now(), (await repos.orderingSettings.get()).timezone);
    const day = input.soldOut ? today : null;
    await repos.menu.setSoldOut(input.recipeId, day, auditStamp(deps, ctx));
    if (current.soldOutOn !== day)
      await repos.audit.record({
        entity: "recipe",
        entityId: input.recipeId,
        action: "UPDATE",
        changes: { soldOutOn: [current.soldOutOn, day] },
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}
