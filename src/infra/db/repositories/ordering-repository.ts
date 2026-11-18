import { and, asc, desc, eq, gt, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  DiningTableRecord,
  DiningTableRepo,
  MenuAccessRepo,
  MenuRepo,
  OrderChoicesRepo,
  OrderingSettingsRepo,
  OrderRecord,
  OrderRepo,
  NewOrder,
  OrderFilter,
  SourceSummaryRow,
} from "@/application/ordering/ports";
import type { CancelReason } from "@/domain/ordering/order";
import type { Audit } from "@/application/access/ports";
import type { CatalogProduct } from "@/domain/ordering/checkout";
import type { ComponentRef } from "@/domain/inventory/recipe";
import { refKey } from "@/domain/inventory/recipe";
import { compareTableNames } from "@/domain/ordering/table-name";
import { describeChanges } from "@/domain/ordering/customization";
import { isOnMenu } from "@/domain/ordering/menu";
import { SUBMIT_GRACE_SECONDS } from "@/domain/ordering/menu-access";
import { HEARTBEAT_SECONDS } from "@/domain/ordering/tablet-signal";
import { err, ok, type Result } from "@/domain/shared/result";
import type { Tx } from "../db";
import {
  addons,
  diningTables,
  items,
  menuAccesses,
  orderDayCounters,
  orderLineAddons,
  orderLineRemovals,
  orderLines,
  orders,
  orderStatusEvents,
  recipeAddons,
  recipeLines,
  recipeRemovables,
  recipes,
  recipeVersions,
  restaurants,
  users,
} from "../schema";
import { dec, isUniqueViolation, UNIT_CODE_BY_ID, withSavepoint } from "./util";
import { groupBy } from "@/domain/shared/collections";

const ref = (itemId: string | null, subRecipeId: string | null): ComponentRef =>
  itemId ? { kind: "ITEM", id: itemId } : { kind: "RECIPE", id: subRecipeId! };

const componentCols = (c: ComponentRef) => ({
  itemId: c.kind === "ITEM" ? c.id : null,
  subRecipeId: c.kind === "RECIPE" ? c.id : null,
});

export function diningTableRepository(tx: Tx, restaurantId: string): DiningTableRepo {
  const cols = {
    id: diningTables.id,
    name: diningTables.name,
    active: diningTables.active,
    qrToken: diningTables.qrToken,
    tabletToken: diningTables.tabletToken,
    version: diningTables.version,
  };

  async function guarded(fn: () => Promise<Result<void>>): Promise<Result<void>> {
    try {
      return await withSavepoint(tx, fn);
    } catch (e) {
      if (isUniqueViolation(e, "dining_tables_active_name")) return err("TABLE_NAME_IN_USE", "name");
      throw e;
    }
  }

  async function optimistic(id: string, version: number, set: Record<string, unknown>, audit: Audit) {
    const r = await tx
      .update(diningTables)
      .set({ ...set, version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
      .where(and(eq(diningTables.id, id), eq(diningTables.version, version)))
      .returning({ id: diningTables.id });
    if (r.length) return ok(undefined);
    const exists = await tx.select({ id: diningTables.id }).from(diningTables).where(eq(diningTables.id, id));
    return exists.length ? err("STALE_RECORD") : err("NOT_FOUND");
  }

  return {
    async list(includeInactive) {
      const rows: DiningTableRecord[] = await tx
        .select(cols)
        .from(diningTables)
        .where(includeInactive ? undefined : eq(diningTables.active, true));
      return rows.sort((a, b) => compareTableNames(a.name, b.name));
    },
    async get(id) {
      const [r] = await tx.select(cols).from(diningTables).where(eq(diningTables.id, id));
      return r ?? null;
    },
    async activeNames() {
      const rows = await tx
        .select({ n: diningTables.nameNormalized })
        .from(diningTables)
        .where(eq(diningTables.active, true));
      return new Set(rows.map((r) => r.n));
    },
    insert: (t, audit) =>
      guarded(async () => {
        await tx.insert(diningTables).values({
          id: t.id,
          restaurantId,
          name: t.name,
          nameNormalized: t.normalized,
          qrToken: t.qrToken,
          qrRotatedAt: audit.at,
          createdAt: audit.at,
          createdBy: audit.by,
          updatedAt: audit.at,
          updatedBy: audit.by,
        });
        return ok(undefined);
      }),
    rename: (id, name, normalized, version, audit) =>
      guarded(() => optimistic(id, version, { name, nameNormalized: normalized }, audit)),
    setActive: (id, active, version, audit) => guarded(() => optimistic(id, version, { active }, audit)),
    rotateQr: (id, qrToken, version, audit) =>
      optimistic(id, version, { qrToken, qrRotatedAt: audit.at }, audit),
    setTabletToken: (id, tabletToken, version, audit) =>
      optimistic(id, version, { tabletToken, tabletTokenRotatedAt: audit.at }, audit),
    async tabletStatus() {
      const rows = await tx
        .select({
          tableId: diningTables.id,
          name: diningTables.name,
          tabletToken: diningTables.tabletToken,
          version: diningTables.version,
          boundAt: menuAccesses.openedAt,
          lastSeenAt: menuAccesses.lastSeenAt,
        })
        .from(diningTables)
        .leftJoin(
          menuAccesses,
          and(
            eq(menuAccesses.tableId, diningTables.id),
            eq(menuAccesses.kind, "TABLET"),
            sql`${menuAccesses.endedAt} is null`,
          ),
        )
        .where(eq(diningTables.active, true));
      return rows.sort((a, b) => compareTableNames(a.name, b.name));
    },
  };
}

export function menuAccessRepository(tx: Tx, restaurantId: string): MenuAccessRepo {
  const cols = {
    id: menuAccesses.id,
    tableId: menuAccesses.tableId,
    kind: menuAccesses.kind,
    openedAt: menuAccesses.openedAt,
    expiresAt: menuAccesses.expiresAt,
    endedAt: menuAccesses.endedAt,
    endReason: menuAccesses.endReason,
    lastSeenAt: menuAccesses.lastSeenAt,
  };
  return {
    async insert(a) {
      await tx.insert(menuAccesses).values({
        id: a.id,
        restaurantId,
        createdAt: a.openedAt,
        tableId: a.tableId,
        tokenHash: a.tokenHash,
        kind: a.kind,
        openedAt: a.openedAt,
        expiresAt: a.expiresAt,
        endedAt: a.endedAt,
        ip: a.ip,
        userAgent: a.userAgent,
      });
    },
    async get(id) {
      const [r] = await tx.select(cols).from(menuAccesses).where(eq(menuAccesses.id, id));
      return r ?? null;
    },
    async end(id, at, reason) {
      await tx
        .update(menuAccesses)
        .set({ endedAt: at, endReason: reason })
        .where(and(eq(menuAccesses.id, id), sql`${menuAccesses.endedAt} is null`));
    },
    async endOpenForTable(tableId, at, reason) {
      // Inclui quem ainda está na tolerância do "Confirmar" do último segundo.
      const graceStart = new Date(at.getTime() - SUBMIT_GRACE_SECONDS * 1000);
      const r = await tx
        .update(menuAccesses)
        .set({ endedAt: at, endReason: reason })
        .where(
          and(
            eq(menuAccesses.tableId, tableId),
            eq(menuAccesses.kind, "QR"),
            sql`${menuAccesses.endedAt} is null`,
            gt(menuAccesses.expiresAt, graceStart),
          ),
        )
        .returning({ id: menuAccesses.id });
      return r.length;
    },
    async insertTablet(a) {
      const r = await tx
        .insert(menuAccesses)
        .values({
          id: a.id,
          restaurantId,
          createdAt: a.openedAt,
          tableId: a.tableId,
          tokenHash: a.tokenHash,
          kind: "TABLET",
          openedAt: a.openedAt,
          expiresAt: null,
          ip: a.ip,
          userAgent: a.userAgent,
        })
        .onConflictDoNothing({
          target: menuAccesses.tableId,
          where: sql`kind = 'TABLET' and ended_at is null`,
        })
        .returning({ id: menuAccesses.id });
      return r.length === 1;
    },
    async openTablet(tableId) {
      const [r] = await tx
        .select(cols)
        .from(menuAccesses)
        .where(
          and(
            eq(menuAccesses.tableId, tableId),
            eq(menuAccesses.kind, "TABLET"),
            sql`${menuAccesses.endedAt} is null`,
          ),
        );
      return r ?? null;
    },
    async touch(id, now) {
      const r = await tx
        .update(menuAccesses)
        .set({ lastSeenAt: now })
        .where(
          and(
            eq(menuAccesses.id, id),
            sql`(${menuAccesses.lastSeenAt} is null or ${menuAccesses.lastSeenAt} <= ${now}::timestamptz - make_interval(secs => ${HEARTBEAT_SECONDS}))`,
          ),
        )
        .returning({ id: menuAccesses.id });
      return r.length === 1;
    },
  };
}

export function orderingSettingsRepository(tx: Tx, restaurantId: string): OrderingSettingsRepo {
  return {
    async get() {
      const [r] = await tx
        .select({
          restaurantName: restaurants.name,
          timezone: restaurants.timezone,
          acceptingQrOrders: restaurants.acceptingQrOrders,
          version: restaurants.version,
          logoBase: restaurants.logoBase,
          logoWidths: restaurants.logoWidths,
          coverBase: restaurants.coverBase,
          coverWidths: restaurants.coverWidths,
        })
        .from(restaurants)
        .where(eq(restaurants.id, restaurantId));
      if (!r) throw new Error("restaurante não encontrado");
      const { logoBase, logoWidths, coverBase, coverWidths, ...settings } = r;
      const photo = (base: string | null, widths: number[] | null) =>
        base && widths ? { base, widths } : null;
      return {
        ...settings,
        appearance: { logo: photo(logoBase, logoWidths), cover: photo(coverBase, coverWidths) },
      };
    },
    async setAcceptingQrOrders(accepting, version, audit) {
      const r = await tx
        .update(restaurants)
        .set({ acceptingQrOrders: accepting, version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
        .where(and(eq(restaurants.id, restaurantId), eq(restaurants.version, version)))
        .returning({ id: restaurants.id });
      return r.length ? ok(undefined) : err("STALE_RECORD");
    },
  };
}

/** Quem lançou o pedido (spec 015): o nome é o de hoje, pela junção. */
const placer = alias(users, "placer");

/** Filtro da consulta (sem a situação, que o resumo por origem não usa). */
const periodWhere = (f: OrderFilter): SQL | undefined =>
  and(
    gte(orders.businessDay, f.fromDay),
    lte(orders.businessDay, f.toDay),
    f.tableId ? eq(orders.tableId, f.tableId) : undefined,
    f.placedBy === "QR" || f.placedBy === "TABLET"
      ? eq(orders.source, f.placedBy)
      : f.placedBy
        ? and(eq(orders.source, "STAFF"), eq(orders.placedBy, f.placedBy))
        : undefined,
  );

export function orderRepository(tx: Tx, restaurantId: string, ids: () => string): OrderRepo {
  async function load(where: SQL | undefined, order: SQL[]): Promise<OrderRecord[]> {
    const rows = await tx
      .select({
        id: orders.id,
        number: orders.number,
        businessDay: orders.businessDay,
        tableId: orders.tableId,
        tableName: diningTables.name,
        menuAccessId: orders.menuAccessId,
        tabId: orders.tabId,
        source: orders.source,
        placedById: orders.placedBy,
        placedByName: placer.name,
        status: orders.status,
        cancelReason: orders.cancelReason,
        cancelNote: orders.cancelNote,
        total: orders.total,
        submittedAt: orders.submittedAt,
        statusChangedAt: orders.statusChangedAt,
        version: orders.version,
      })
      .from(orders)
      .innerJoin(diningTables, eq(diningTables.id, orders.tableId))
      .leftJoin(placer, eq(placer.id, orders.placedBy))
      .where(where)
      .orderBy(...order);
    if (!rows.length) return [];
    const lines = await tx
      .select({
        id: orderLines.id,
        orderId: orderLines.orderId,
        quantity: orderLines.quantity,
        unitPrice: orderLines.unitPrice,
        kitchenNote: orderLines.kitchenNote,
        recipeId: orderLines.recipeId,
        productName: recipes.name,
      })
      .from(orderLines)
      .innerJoin(recipes, eq(recipes.id, orderLines.recipeId))
      .where(
        inArray(
          orderLines.orderId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(orderLines.position));
    const lineIds = lines.map((l) => l.id);
    const chosenAddons = lineIds.length
      ? await tx
          .select({
            lineId: orderLineAddons.orderLineId,
            addonId: orderLineAddons.addonId,
            name: orderLineAddons.name,
            times: orderLineAddons.times,
          })
          .from(orderLineAddons)
          .where(inArray(orderLineAddons.orderLineId, lineIds))
          .orderBy(asc(orderLineAddons.createdAt), asc(orderLineAddons.id))
      : [];
    const removals = lineIds.length
      ? await tx
          .select({
            lineId: orderLineRemovals.orderLineId,
            label: orderLineRemovals.label,
            itemId: orderLineRemovals.itemId,
            subRecipeId: orderLineRemovals.subRecipeId,
          })
          .from(orderLineRemovals)
          .where(inArray(orderLineRemovals.orderLineId, lineIds))
          .orderBy(asc(orderLineRemovals.createdAt), asc(orderLineRemovals.id))
      : [];
    const linesByOrder = groupBy(lines, (l) => l.orderId);
    const addonsByLine = groupBy(chosenAddons, (a) => a.lineId);
    const removalsByLine = groupBy(removals, (x) => x.lineId);
    return rows.map((r) => ({
      ...r,
      total: dec(r.total)!,
      lines: (linesByOrder.get(r.id) ?? []).map((l) => ({
        quantity: l.quantity,
        productName: l.productName,
        unitPrice: dec(l.unitPrice)!,
        changes: describeChanges(
          addonsByLine.get(l.id) ?? [],
          (removalsByLine.get(l.id) ?? []).map((x) => x.label),
        ),
        kitchenNote: l.kitchenNote,
        recipeId: l.recipeId,
        addons: (addonsByLine.get(l.id) ?? []).map((a) => ({ addonId: a.addonId, times: a.times })),
        removals: (removalsByLine.get(l.id) ?? []).map((x) => ref(x.itemId, x.subRecipeId)),
      })),
    }));
  }

  async function takeNextNumber(businessDay: string): Promise<number> {
    const [r] = await tx
      .insert(orderDayCounters)
      .values({ restaurantId, businessDay, lastNumber: 1 })
      .onConflictDoUpdate({
        target: [orderDayCounters.restaurantId, orderDayCounters.businessDay],
        set: { lastNumber: sql`${orderDayCounters.lastNumber} + 1` },
      })
      .returning({ n: orderDayCounters.lastNumber });
    return r!.n;
  }

  async function insertOrder(o: NewOrder, number: number) {
    const placedBy = o.origin.source === "STAFF" ? o.origin.placedBy : null;
    await tx.insert(orders).values({
      id: o.id,
      restaurantId,
      createdAt: o.submittedAt,
      createdBy: placedBy,
      tableId: o.tableId,
      tabId: o.tabId,
      source: o.origin.source,
      placedBy,
      menuAccessId: o.origin.source === "STAFF" ? null : o.origin.menuAccessId,
      clientRequestId: o.clientRequestId,
      businessDay: o.businessDay,
      number,
      status: "RECEIVED",
      total: o.total.toFixed(2),
      submittedAt: o.submittedAt,
      statusChangedAt: o.submittedAt,
    });
    // Em lote (spec 012, R6): o número de idas ao banco não cresce com o número de linhas.
    const lines = o.lines.map((l, position) => ({ id: ids(), position, l }));
    await tx.insert(orderLines).values(
      lines.map(({ id, position, l }) => ({
        id,
        restaurantId,
        createdAt: o.submittedAt,
        orderId: o.id,
        position,
        recipeId: l.recipeId,
        recipeVersionId: l.versionId,
        quantity: l.quantity,
        basePrice: l.basePrice.toFixed(2),
        unitPrice: l.unitPrice.toFixed(2),
        kitchenNote: l.kitchenNote,
      })),
    );
    const addonIds = [...new Set(o.lines.flatMap((l) => l.addons.map((a) => a.addonId)))];
    if (addonIds.length) {
      // Cópia do que o adicional baixa hoje: o pedido guarda o consumo do envio (spec 010).
      const current = await tx
        .select({
          id: addons.id,
          itemId: addons.itemId,
          subRecipeId: addons.subRecipeId,
          quantity: addons.quantity,
          unitId: addons.unitId,
        })
        .from(addons)
        .where(inArray(addons.id, addonIds));
      const byId = new Map(current.map((a) => [a.id, a]));
      await tx.insert(orderLineAddons).values(
        lines.flatMap(({ id: lineId, l }) =>
          l.addons.map((a) => {
            const c = byId.get(a.addonId)!;
            return {
              id: ids(),
              restaurantId,
              createdAt: o.submittedAt,
              orderLineId: lineId,
              addonId: a.addonId,
              name: a.name,
              times: a.times,
              unitPrice: a.unitPrice.toFixed(2),
              itemId: c.itemId,
              subRecipeId: c.subRecipeId,
              quantity: c.quantity,
              unitId: c.unitId,
            };
          }),
        ),
      );
    }
    const removals = lines.flatMap(({ id: lineId, l }) =>
      l.removals.map((r) => ({
        id: ids(),
        restaurantId,
        createdAt: o.submittedAt,
        orderLineId: lineId,
        ...componentCols(r.component),
        label: r.label,
      })),
    );
    if (removals.length) await tx.insert(orderLineRemovals).values(removals);
    await tx.insert(orderStatusEvents).values({
      id: ids(),
      restaurantId,
      createdAt: o.submittedAt,
      orderId: o.id,
      fromStatus: null,
      toStatus: "RECEIVED",
      userId: placedBy,
      at: o.submittedAt,
    });
  }

  return {
    async findByClientRequest(menuAccessId, clientRequestId) {
      const [r] = await load(
        and(eq(orders.menuAccessId, menuAccessId), eq(orders.clientRequestId, clientRequestId)),
        [],
      );
      return r ?? null;
    },
    async findStaffByClientRequest(placedBy, clientRequestId) {
      const [r] = await load(
        and(
          eq(orders.source, "STAFF"),
          eq(orders.placedBy, placedBy),
          eq(orders.clientRequestId, clientRequestId),
        ),
        [],
      );
      return r ?? null;
    },
    async summaryBySource(f) {
      const rows = await tx
        .select({
          source: orders.source,
          placedById: orders.placedBy,
          name: placer.name,
          cancelReason: orders.cancelReason,
          count: sql<number>`count(*)::int`,
          total: sql<string>`sum(${orders.total})`,
        })
        .from(orders)
        .leftJoin(placer, eq(placer.id, orders.placedBy))
        .where(periodWhere(f))
        .groupBy(orders.source, orders.placedBy, placer.name, orders.cancelReason);
      const groups = new Map<string, SourceSummaryRow>();
      for (const r of rows) {
        const key = `${r.source}:${r.placedById ?? ""}`;
        const g = groups.get(key) ?? {
          source: r.source,
          placedById: r.placedById,
          name: r.name,
          count: 0,
          total: dec("0")!,
          cancelled: [],
        };
        if (r.cancelReason)
          g.cancelled.push({ reason: r.cancelReason as CancelReason, count: Number(r.count) });
        else {
          g.count += Number(r.count);
          g.total = g.total.plus(dec(r.total)!);
        }
        groups.set(key, g);
      }
      // QR code primeiro, depois o tablet da mesa (016) e a equipe pelo nome.
      const rank = { QR: 0, TABLET: 1, STAFF: 2 } as const;
      return [...groups.values()].sort(
        (a, b) =>
          rank[a.source] - rank[b.source] ||
          (a.name ?? "").localeCompare(b.name ?? "", "pt-BR"),
      );
    },
    async staffPlacers() {
      return tx
        .selectDistinct({ id: placer.id, name: placer.name })
        .from(orders)
        .innerJoin(placer, eq(placer.id, orders.placedBy))
        .where(eq(orders.source, "STAFF"))
        .orderBy(asc(placer.name));
    },
    async countForAccess(menuAccessId) {
      const [r] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(orders)
        .where(eq(orders.menuAccessId, menuAccessId));
      return Number(r?.n ?? 0);
    },
    async insert(o) {
      try {
        return await withSavepoint(tx, async () => {
          const number = await takeNextNumber(o.businessDay);
          await insertOrder(o, number);
          return { number };
        });
      } catch (e) {
        if (
          isUniqueViolation(e, "orders_client_request") ||
          isUniqueViolation(e, "orders_staff_client_request")
        )
          return null;
        throw e;
      }
    },
    async get(id) {
      const [r] = await load(eq(orders.id, id), []);
      return r ?? null;
    },
    async events(id) {
      return tx
        .select({
          fromStatus: orderStatusEvents.fromStatus,
          toStatus: orderStatusEvents.toStatus,
          reason: orderStatusEvents.reason,
          userName: users.name,
          at: orderStatusEvents.at,
        })
        .from(orderStatusEvents)
        .leftJoin(users, eq(users.id, orderStatusEvents.userId))
        .where(eq(orderStatusEvents.orderId, id))
        .orderBy(asc(orderStatusEvents.at), asc(orderStatusEvents.id));
    },
    listByStatus: (statuses) =>
      load(inArray(orders.status, [...statuses]), [asc(orders.submittedAt), asc(orders.number)]),
    listForAccess: (menuAccessId) =>
      load(eq(orders.menuAccessId, menuAccessId), [desc(orders.submittedAt), desc(orders.number)]),
    listForTab: (tabId) => load(eq(orders.tabId, tabId), [asc(orders.submittedAt), asc(orders.number)]),
    async tabletStamp(tableId) {
      const r = await tx.execute<{
        rv: number;
        tv: number;
        tab_id: string | null;
        changed: string | null;
        n: string;
      }>(
        // Soma das versões: muda a cada pedido novo e a cada mudança de situação, mesmo no mesmo instante.
        sql`select r.version as rv, t.version as tv, tab.id as tab_id,
              (select max(o.status_changed_at)::text from orders o where o.tab_id = tab.id) as changed,
              (select count(*) || '.' || coalesce(sum(o.version), 0) from orders o where o.tab_id = tab.id) as n
            from restaurants r
            join dining_tables t on t.id = ${tableId} and t.restaurant_id = r.id
            left join table_tabs tab on tab.table_id = t.id and tab.status = 'OPEN'
            where r.id = ${restaurantId}`,
      );
      const row = r.rows[0];
      if (!row) return { tabId: null, stamp: "" };
      return {
        tabId: row.tab_id,
        stamp: [row.rv, row.tv, row.tab_id ?? "-", row.changed ?? "-", row.n].join("|"),
      };
    },
    list: (f) =>
      load(and(periodWhere(f), f.status ? eq(orders.status, f.status) : undefined), [
        desc(orders.businessDay),
        desc(orders.number),
      ]),
    async changeStatus(id, change, version, audit) {
      const r = await tx
        .update(orders)
        .set({
          status: change.to,
          cancelReason: change.reason,
          cancelNote: change.note,
          statusChangedAt: audit.at,
          version: version + 1,
        })
        .where(and(eq(orders.id, id), eq(orders.version, version), eq(orders.status, change.from)))
        .returning({ id: orders.id });
      if (!r.length) {
        const exists = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, id));
        return exists.length ? err("STALE_RECORD") : err("NOT_FOUND");
      }
      await tx.insert(orderStatusEvents).values({
        id: ids(),
        restaurantId,
        createdAt: audit.at,
        orderId: id,
        fromStatus: change.from,
        toStatus: change.to,
        reason: change.reason,
        userId: audit.by,
        at: audit.at,
      });
      return ok(undefined);
    },
  };
}

export function menuRepository(tx: Tx): MenuRepo {
  return {
    async products() {
      const rows = await tx
        .select({
          id: recipes.id,
          name: recipes.name,
          kind: recipes.kind,
          active: recipes.active,
          salePrice: recipes.salePrice,
          soldOutOn: recipes.soldOutOn,
        })
        .from(recipes)
        .where(eq(recipes.kind, "DISH"))
        // Lista da cozinha ("Esgotado hoje"): alfabética. A ordem do cardápio do cliente vem do
        // `menuBoard` (spec 013).
        .orderBy(asc(recipes.nameNormalized));
      return rows.map((r) => ({ ...r, salePrice: dec(r.salePrice) }));
    },

    async catalog(recipeIds, today) {
      const out = new Map<string, CatalogProduct>();
      const ids = [...new Set(recipeIds)];
      if (!ids.length) return out;
      const rows = await tx.select().from(recipes).where(inArray(recipes.id, ids));
      if (!rows.length) return out;
      const found = rows.map((r) => r.id);
      const versions = await tx
        .selectDistinctOn([recipeVersions.recipeId], {
          id: recipeVersions.id,
          recipeId: recipeVersions.recipeId,
        })
        .from(recipeVersions)
        .where(inArray(recipeVersions.recipeId, found))
        .orderBy(recipeVersions.recipeId, desc(recipeVersions.number));
      const versionOf = new Map(versions.map((v) => [v.recipeId, v.id]));
      const lines = versions.length
        ? await tx
            .select({
              versionId: recipeLines.recipeVersionId,
              itemId: recipeLines.itemId,
              subRecipeId: recipeLines.subRecipeId,
            })
            .from(recipeLines)
            .where(
              inArray(
                recipeLines.recipeVersionId,
                versions.map((v) => v.id),
              ),
            )
        : [];
      const offered = await tx
        .select({
          recipeId: recipeAddons.recipeId,
          addonId: addons.id,
          name: addons.name,
          price: addons.price,
          maxTimes: recipeAddons.maxTimes,
          active: addons.active,
          itemActive: items.active,
          subRecipeActive: sql<
            boolean | null
          >`(select r.active from ${recipes} r where r.id = ${addons.subRecipeId})`,
        })
        .from(recipeAddons)
        .innerJoin(addons, eq(addons.id, recipeAddons.addonId))
        .leftJoin(items, eq(items.id, addons.itemId))
        .where(inArray(recipeAddons.recipeId, found))
        .orderBy(asc(recipeAddons.position));
      const removables = await tx
        .select({
          recipeId: recipeRemovables.recipeId,
          itemId: recipeRemovables.itemId,
          subRecipeId: recipeRemovables.subRecipeId,
          label: recipeRemovables.label,
        })
        .from(recipeRemovables)
        .where(inArray(recipeRemovables.recipeId, found))
        .orderBy(asc(recipeRemovables.position));

      const linesByVersion = groupBy(lines, (l) => l.versionId);
      const offeredByRecipe = groupBy(offered, (a) => a.recipeId);
      const removablesByRecipe = groupBy(removables, (x) => x.recipeId);
      for (const r of rows) {
        const versionId = versionOf.get(r.id);
        if (!versionId) continue;
        const inVersion = new Set(
          (linesByVersion.get(versionId) ?? []).map((l) => refKey(ref(l.itemId, l.subRecipeId))),
        );
        out.set(r.id, {
          id: r.id,
          name: r.name,
          versionId,
          salePrice: dec(r.salePrice),
          available: isOnMenu(
            {
              id: r.id,
              name: r.name,
              kind: r.kind,
              active: r.active,
              salePrice: dec(r.salePrice),
              soldOutOn: r.soldOutOn,
            },
            today,
          ),
          options: {
            addons: (offeredByRecipe.get(r.id) ?? []).map((a) => ({
              addonId: a.addonId,
              name: a.name,
              price: dec(a.price)!,
              maxTimes: a.maxTimes,
              available: a.active && (a.itemActive ?? a.subRecipeActive ?? false) === true,
            })),
            removables: (removablesByRecipe.get(r.id) ?? []).map((x) => {
              const component = ref(x.itemId, x.subRecipeId);
              return { component, label: x.label, available: inVersion.has(refKey(component)) };
            }),
          },
        });
      }
      return out;
    },

    async setSoldOut(recipeId, day, audit) {
      await tx
        .update(recipes)
        .set({ soldOutOn: day, updatedAt: audit.at, updatedBy: audit.by })
        .where(eq(recipes.id, recipeId));
    },
  };
}

export function orderChoicesRepository(tx: Tx): OrderChoicesRepo {
  return {
    async forOrder(orderId) {
      const [o] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId));
      if (!o) return null;
      const lines = await tx
        .select({
          id: orderLines.id,
          recipeId: orderLines.recipeId,
          recipeVersionId: orderLines.recipeVersionId,
          quantity: orderLines.quantity,
        })
        .from(orderLines)
        .where(eq(orderLines.orderId, orderId))
        .orderBy(asc(orderLines.position));
      const lineIds = lines.map((l) => l.id);
      if (!lineIds.length) return [];
      const chosen = await tx
        .select()
        .from(orderLineAddons)
        .where(inArray(orderLineAddons.orderLineId, lineIds));
      const removed = await tx
        .select()
        .from(orderLineRemovals)
        .where(inArray(orderLineRemovals.orderLineId, lineIds));
      const versionLines = await tx
        .select()
        .from(recipeLines)
        .where(
          inArray(
            recipeLines.recipeVersionId,
            lines.map((l) => l.recipeVersionId),
          ),
        )
        .orderBy(asc(recipeLines.position));
      const versionLinesByVersion = groupBy(versionLines, (v) => v.recipeVersionId);
      const chosenByLine = groupBy(chosen, (a) => a.orderLineId);
      const removedByLine = groupBy(removed, (x) => x.orderLineId);
      return lines.map((l) => ({
        recipeId: l.recipeId,
        recipeVersionId: l.recipeVersionId,
        versionLines: (versionLinesByVersion.get(l.recipeVersionId) ?? []).map((v) => ({
          component: ref(v.itemId, v.subRecipeId),
          quantity: dec(v.quantity)!,
          unit: UNIT_CODE_BY_ID[v.unitId]!,
        })),
        quantity: l.quantity,
        addons: (chosenByLine.get(l.id) ?? []).map((a) => ({
          component: ref(a.itemId, a.subRecipeId),
          quantity: dec(a.quantity)!,
          unit: UNIT_CODE_BY_ID[a.unitId]!,
          times: a.times,
        })),
        removals: (removedByLine.get(l.id) ?? []).map((x) => ref(x.itemId, x.subRecipeId)),
      }));
    },
  };
}
