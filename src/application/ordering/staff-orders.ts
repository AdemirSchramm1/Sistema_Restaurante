import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { authorize } from "../shared";
import { activePayments } from "../billing/tabs";
import type { MenuProduct } from "./menu";
import type { OrderRecord } from "./ports";
import { saveOrder } from "./save-order";
import { parseStaffOrderInput } from "./staff-order-input";
import { can } from "@/domain/access/permissions";
import { tabTotals } from "@/domain/billing/tab";
import { buildStaffMenu } from "@/domain/menu/staff-menu";
import type { CustomerMenu } from "@/domain/menu/customer-menu";
import { menuProducts } from "@/domain/menu/customer-menu";
import { businessDay } from "@/domain/ordering/business-day";
import { checkOrder } from "@/domain/ordering/checkout";
import { checkKitchenNote } from "@/domain/ordering/kitchen-note";
import { cancelScope, type OrderSource, type OrderStatus } from "@/domain/ordering/order";
import { sameRequest, type StaffRequest } from "@/domain/ordering/staff-request";
import type { ComponentRef } from "@/domain/inventory/recipe";
import { err, ok, type Result } from "@/domain/shared/result";

/** Garçom lança o pedido da mesa (spec 015, contracts/use-cases.md). */

const ENTITY = "order";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StaffTableView = {
  id: string;
  name: string;
  tab: { id: string; openedAt: string; total: string } | null;
  readyCount: number;
};

export type StaffMenuProduct = MenuProduct & { soldOut: boolean };

export type StaffMenuView = {
  table: { id: string; name: string };
  tab: { id: string; total: string } | null;
  qrOrdersOff: boolean;
} & CustomerMenu<StaffMenuProduct>;

export type PlaceStaffOrderResult = {
  orderId: string;
  number: number;
  total: string;
  tableName: string;
  previousTabClosed: boolean;
};

/** Escolhas de uma linha gravada, para Pedir de novo e o aviso de pedido parecido (R20, R21). */
export type AgainLine = {
  recipeId: string;
  quantity: number;
  addons: { addonId: string; times: number }[];
  removals: ComponentRef[];
  kitchenNote: string | null;
};

export type TableOrderView = {
  id: string;
  number: number;
  submittedAt: string;
  source: OrderSource;
  placedById: string | null;
  placedByName: string | null;
  status: OrderStatus;
  total: string;
  version: number;
  canCancel: boolean;
  canDeliver: boolean;
  lines: {
    quantity: number;
    productName: string;
    changes: string[];
    kitchenNote: string | null;
    again: AgainLine;
  }[];
};

export type TableOrdersView = {
  table: { id: string; name: string };
  tab: {
    id: string;
    subtotal: string;
    serviceCharge: string;
    total: string;
    paid: string;
    remaining: string;
  } | null;
  orders: TableOrderView[];
};

/** Conta aberta de cada mesa, com o total de agora (pedidos não cancelados + taxa). */
async function openTabsByTable(repos: Repos) {
  const open = await repos.tabs.listOpen();
  return new Map(open.map((t) => [t.tableId, { tab: t, totals: tabTotals(t) }]));
}

/** Grade de mesas ativas (US1-1): conta aberta, total, há quanto tempo e prontos para levar. */
export async function listTablesForStaff(
  deps: Deps,
  ctx: RequestContext,
): Promise<Result<{ qrOrdersOff: boolean; tables: StaffTableView[] }>> {
  const allowed = await authorize(deps, ctx, "order.place", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const settings = await repos.orderingSettings.get();
    const tables = await repos.tables.list(false);
    const tabs = await openTabsByTable(repos);
    const ready = await repos.orders.listByStatus(["READY"]);
    return ok({
      qrOrdersOff: !settings.acceptingQrOrders,
      tables: tables.map((t) => {
        const open = tabs.get(t.id);
        return {
          id: t.id,
          name: t.name,
          tab: open
            ? {
                id: open.tab.id,
                openedAt: open.tab.openedAt.toISOString(),
                total: open.totals.total.toFixed(2),
              }
            : null,
          readyCount: ready.filter((o) => o.tableId === t.id).length,
        };
      }),
    });
  });
}

/** Mesa ativa do restaurante, ou o erro que a tela do garçom mostra. */
async function activeTable(repos: Repos, tableId: string) {
  const table = UUID.test(tableId) ? await repos.tables.get(tableId) : null;
  if (!table) return err("NOT_FOUND");
  if (!table.active) return err("STAFF_TABLE_INACTIVE", undefined, { tableName: table.name });
  return ok(table);
}

/**
 * Cardápio da equipe (FR-003): o do cliente, com o esgotado de hoje apagado no fim da seção e sem
 * adicionais nem retiradas (não pode ir ao carrinho).
 */
async function staffMenu(repos: Repos, today: string): Promise<CustomerMenu<StaffMenuProduct>> {
  const grouped = buildStaffMenu(await repos.menuBoard.sections(), await repos.menuBoard.products(), today);
  const catalog = await repos.menu.catalog(
    menuProducts(grouped).map((r) => r.id),
    today,
  );
  const sections = grouped.sections
    .map((s) => ({
      ...s,
      products: s.products.flatMap((r): StaffMenuProduct[] => {
        const p = catalog.get(r.id);
        if (!p || !p.salePrice) return [];
        const base = {
          id: p.id,
          name: p.name,
          price: p.salePrice.toFixed(2),
          description: r.description,
          photo: r.photo,
        };
        if (r.soldOut) return [{ ...base, addons: [], removables: [], soldOut: true }];
        if (!p.available) return [];
        return [
          {
            ...base,
            soldOut: false,
            addons: p.options.addons
              .filter((a) => a.available)
              .map((a) => ({ id: a.addonId, name: a.name, price: a.price.toFixed(2), maxTimes: a.maxTimes })),
            removables: p.options.removables
              .filter((x) => x.available)
              .map((x) => ({ kind: x.component.kind, id: x.component.id, label: x.label })),
          },
        ];
      }),
    }))
    .filter((s) => s.products.length > 0);
  return { showSectionTitles: grouped.showSectionTitles, sections };
}

/** Cardápio da mesa para o garçom (US1-2). */
export async function getStaffMenu(
  deps: Deps,
  ctx: RequestContext,
  tableId: string,
): Promise<Result<StaffMenuView>> {
  const allowed = await authorize(deps, ctx, "order.place", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const table = await activeTable(repos, tableId);
    if (!table.ok) return table;
    const settings = await repos.orderingSettings.get();
    const open = (await openTabsByTable(repos)).get(tableId);
    const menu = await staffMenu(repos, businessDay(deps.clock.now(), settings.timezone));
    return ok({
      table: { id: table.value.id, name: table.value.name },
      tab: open ? { id: open.tab.id, total: open.totals.total.toFixed(2) } : null,
      qrOrdersOff: !settings.acceptingQrOrders,
      ...menu,
    });
  });
}

const againOf = (l: OrderRecord["lines"][number]): AgainLine => ({
  recipeId: l.recipeId,
  quantity: l.quantity,
  addons: l.addons,
  removals: l.removals,
  kitchenNote: l.kitchenNote,
});

const stored = (o: OrderRecord): StaffRequest => ({ tableId: o.tableId, lines: o.lines.map(againOf) });

/**
 * Lança o pedido da mesa (FR-004 a FR-007, FR-011). Mesmas conferências do QR code, sem acesso, sem
 * o limite de 10 pedidos e sem a chave do QR code. O mesmo envio devolve o mesmo pedido; com outro
 * conteúdo, `REQUEST_REUSED`.
 */
export async function placeStaffOrder(
  deps: Deps,
  ctx: RequestContext,
  raw: unknown,
): Promise<Result<PlaceStaffOrderResult>> {
  const allowed = await authorize(deps, ctx, "order.place", ENTITY);
  if (!allowed.ok) return allowed;
  const input = parseStaffOrderInput(raw);
  if (!input.ok) return input;
  const { tableId, clientRequestId, tabIdSeen } = input.value;
  const requested: StaffRequest = {
    tableId,
    lines: input.value.lines.map((l) => ({
      recipeId: l.recipeId,
      quantity: l.quantity,
      addons: l.addons.map((a) => ({ addonId: a.addonId, times: a.times })),
      removals: l.removals,
      kitchenNote: l.kitchenNote?.trim() || null,
    })),
  };
  const answer = (o: OrderRecord): Result<PlaceStaffOrderResult> =>
    sameRequest(stored(o), requested)
      ? ok({
          orderId: o.id,
          number: o.number,
          total: o.total.toFixed(2),
          tableName: o.tableName,
          previousTabClosed: tabIdSeen !== null && tabIdSeen !== o.tabId,
        })
      : err("REQUEST_REUSED");

  return deps.tenant(ctx.restaurantId, async (repos) => {
    const same = await repos.orders.findStaffByClientRequest(ctx.userId, clientRequestId);
    if (same) return answer(same);
    const table = await activeTable(repos, tableId);
    if (!table.ok) return table;

    const lines = [];
    for (const [i, l] of input.value.lines.entries()) {
      const note = checkKitchenNote(l.kitchenNote);
      if (!note.ok) return err("NOTE_TOO_LONG", `lines.${i}.kitchenNote`);
      lines.push({ ...l, kitchenNote: note.value });
    }
    const now = deps.clock.now();
    const today = businessDay(now, (await repos.orderingSettings.get()).timezone);
    const catalog = await repos.menu.catalog(
      lines.map((l) => l.recipeId),
      today,
    );
    const priced = checkOrder(lines, catalog, 0);
    if (!priced.ok) return priced;

    const saved = await saveOrder(deps, repos, {
      tableId,
      origin: { source: "STAFF", placedBy: ctx.userId },
      clientRequestId,
      businessDay: today,
      now,
      lines: priced.value,
    });
    if (!saved) {
      // Outro toque com o mesmo envio chegou primeiro.
      const first = await repos.orders.findStaffByClientRequest(ctx.userId, clientRequestId);
      return first ? answer(first) : err("STALE_RECORD");
    }
    await repos.audit.record({
      entity: ENTITY,
      entityId: saved.orderId,
      action: "CREATE",
      changes: { source: "STAFF", tableId, number: saved.number, total: saved.total.toFixed(2) },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({
      orderId: saved.orderId,
      number: saved.number,
      total: saved.total.toFixed(2),
      tableName: table.value.name,
      previousTabClosed: tabIdSeen !== null && tabIdSeen !== saved.tabId,
    });
  });
}

/** Pedidos da mesa (US3, FR-009): os da conta aberta, de todas as origens, mais novo primeiro. */
export async function listTableOrders(
  deps: Deps,
  ctx: RequestContext,
  tableId: string,
): Promise<Result<TableOrdersView>> {
  const allowed = await authorize(deps, ctx, "order.place", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos): Promise<Result<TableOrdersView>> => {
    const table = UUID.test(tableId) ? await repos.tables.get(tableId) : null;
    if (!table) return err("NOT_FOUND");
    const view = { table: { id: table.id, name: table.name } };
    const open = (await openTabsByTable(repos)).get(tableId);
    if (!open) return ok({ ...view, tab: null, orders: [] });
    const orders = await repos.orders.listForTab(open.tab.id);
    const payments = activePayments(await repos.tabs.payments(open.tab.id));
    const totals = tabTotals({
      orders,
      payments,
      serviceRate: open.tab.serviceRate,
      serviceWaived: open.tab.serviceWaived,
    });
    const who = {
      userId: ctx.userId,
      canCancel: can(ctx.roles, "order.cancel"),
      canCancelOwn: can(ctx.roles, "order.cancel_own"),
    };
    const canDeliver = can(ctx.roles, "order.deliver");
    return ok({
      ...view,
      tab: {
        id: open.tab.id,
        subtotal: totals.subtotal.toFixed(2),
        serviceCharge: totals.serviceCharge.toFixed(2),
        total: totals.total.toFixed(2),
        paid: totals.paid.toFixed(2),
        remaining: totals.remaining.toFixed(2),
      },
      orders: [...orders].reverse().map((o) => {
        const scope = cancelScope(o, who);
        return {
          id: o.id,
          number: o.number,
          submittedAt: o.submittedAt.toISOString(),
          source: o.source,
          placedById: o.placedById,
          placedByName: o.placedByName,
          status: o.status,
          total: o.total.toFixed(2),
          version: o.version,
          canCancel: scope === "OWN" || (scope === "ANY" && o.status === "RECEIVED"),
          canDeliver: canDeliver && o.status === "READY",
          lines: o.lines.map((l) => ({
            quantity: l.quantity,
            productName: l.productName,
            changes: l.changes,
            kitchenNote: l.kitchenNote,
            again: againOf(l),
          })),
        };
      }),
    });
  });
}
