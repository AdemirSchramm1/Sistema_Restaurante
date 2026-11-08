import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
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
} from "@/application/ordering/ports";
import type { Audit } from "@/application/access/ports";
import type { CatalogProduct } from "@/domain/ordering/checkout";
import type { ComponentRef } from "@/domain/inventory/recipe";
import { refKey } from "@/domain/inventory/recipe";
import { compareTableNames } from "@/domain/ordering/table-name";
import { describeChanges } from "@/domain/ordering/customization";
import { isOnMenu } from "@/domain/ordering/menu";
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
  };
}

export function menuAccessRepository(tx: Tx, restaurantId: string): MenuAccessRepo {
  const cols = {
    id: menuAccesses.id,
    tableId: menuAccesses.tableId,
    openedAt: menuAccesses.openedAt,
    expiresAt: menuAccesses.expiresAt,
    endedAt: menuAccesses.endedAt,
  };
  return {
    async insert(a) {
      await tx.insert(menuAccesses).values({
        id: a.id,
        restaurantId,
        createdAt: a.openedAt,
        tableId: a.tableId,
        tokenHash: a.tokenHash,
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
    async end(id, at) {
      await tx
        .update(menuAccesses)
        .set({ endedAt: at })
        .where(and(eq(menuAccesses.id, id), sql`${menuAccesses.endedAt} is null`));
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
        })
        .from(restaurants)
        .where(eq(restaurants.id, restaurantId));
      if (!r) throw new Error("restaurante não encontrado");
      return r;
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
      .where(where)
      .orderBy(...order);
    if (!rows.length) return [];
    const lines = await tx
      .select({
        id: orderLines.id,
        orderId: orderLines.orderId,
        quantity: orderLines.quantity,
        unitPrice: orderLines.unitPrice,
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
            name: orderLineAddons.name,
            times: orderLineAddons.times,
          })
          .from(orderLineAddons)
          .where(inArray(orderLineAddons.orderLineId, lineIds))
          .orderBy(asc(orderLineAddons.createdAt), asc(orderLineAddons.id))
      : [];
    const removals = lineIds.length
      ? await tx
          .select({ lineId: orderLineRemovals.orderLineId, label: orderLineRemovals.label })
          .from(orderLineRemovals)
          .where(inArray(orderLineRemovals.orderLineId, lineIds))
          .orderBy(asc(orderLineRemovals.createdAt), asc(orderLineRemovals.id))
      : [];
    return rows.map((r) => ({
      ...r,
      total: dec(r.total)!,
      lines: lines
        .filter((l) => l.orderId === r.id)
        .map((l) => ({
          quantity: l.quantity,
          productName: l.productName,
          unitPrice: dec(l.unitPrice)!,
          changes: describeChanges(
            chosenAddons.filter((a) => a.lineId === l.id),
            removals.filter((x) => x.lineId === l.id).map((x) => x.label),
          ),
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
    await tx.insert(orders).values({
      id: o.id,
      restaurantId,
      createdAt: o.submittedAt,
      tableId: o.tableId,
      menuAccessId: o.menuAccessId,
      clientRequestId: o.clientRequestId,
      businessDay: o.businessDay,
      number,
      status: "RECEIVED",
      total: o.total.toFixed(2),
      submittedAt: o.submittedAt,
      statusChangedAt: o.submittedAt,
    });
    for (const [position, l] of o.lines.entries()) {
      const lineId = ids();
      await tx.insert(orderLines).values({
        id: lineId,
        restaurantId,
        createdAt: o.submittedAt,
        orderId: o.id,
        position,
        recipeId: l.recipeId,
        recipeVersionId: l.versionId,
        quantity: l.quantity,
        basePrice: l.basePrice.toFixed(2),
        unitPrice: l.unitPrice.toFixed(2),
      });
      if (l.addons.length) {
        const current = await tx
          .select({
            id: addons.id,
            itemId: addons.itemId,
            subRecipeId: addons.subRecipeId,
            quantity: addons.quantity,
            unitId: addons.unitId,
          })
          .from(addons)
          .where(
            inArray(
              addons.id,
              l.addons.map((a) => a.addonId),
            ),
          );
        const byId = new Map(current.map((a) => [a.id, a]));
        await tx.insert(orderLineAddons).values(
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
        );
      }
      if (l.removals.length)
        await tx.insert(orderLineRemovals).values(
          l.removals.map((r) => ({
            id: ids(),
            restaurantId,
            createdAt: o.submittedAt,
            orderLineId: lineId,
            ...componentCols(r.component),
            label: r.label,
          })),
        );
    }
    await tx.insert(orderStatusEvents).values({
      id: ids(),
      restaurantId,
      createdAt: o.submittedAt,
      orderId: o.id,
      fromStatus: null,
      toStatus: "RECEIVED",
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
        if (isUniqueViolation(e, "orders_client_request")) return null;
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
    list: (f) =>
      load(
        and(
          gte(orders.businessDay, f.fromDay),
          lte(orders.businessDay, f.toDay),
          f.tableId ? eq(orders.tableId, f.tableId) : undefined,
          f.status ? eq(orders.status, f.status) : undefined,
        ),
        [desc(orders.businessDay), desc(orders.number)],
      ),
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

      for (const r of rows) {
        const versionId = versionOf.get(r.id);
        if (!versionId) continue;
        const inVersion = new Set(
          lines.filter((l) => l.versionId === versionId).map((l) => refKey(ref(l.itemId, l.subRecipeId))),
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
            addons: offered
              .filter((a) => a.recipeId === r.id)
              .map((a) => ({
                addonId: a.addonId,
                name: a.name,
                price: dec(a.price)!,
                maxTimes: a.maxTimes,
                available: a.active && (a.itemActive ?? a.subRecipeActive ?? false) === true,
              })),
            removables: removables
              .filter((x) => x.recipeId === r.id)
              .map((x) => {
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
      return lines.map((l) => ({
        recipeId: l.recipeId,
        recipeVersionId: l.recipeVersionId,
        versionLines: versionLines
          .filter((v) => v.recipeVersionId === l.recipeVersionId)
          .map((v) => ({
            component: ref(v.itemId, v.subRecipeId),
            quantity: dec(v.quantity)!,
            unit: UNIT_CODE_BY_ID[v.unitId]!,
          })),
        quantity: l.quantity,
        addons: chosen
          .filter((a) => a.orderLineId === l.id)
          .map((a) => ({
            component: ref(a.itemId, a.subRecipeId),
            quantity: dec(a.quantity)!,
            unit: UNIT_CODE_BY_ID[a.unitId]!,
            times: a.times,
          })),
        removals: removed.filter((x) => x.orderLineId === l.id).map((x) => ref(x.itemId, x.subRecipeId)),
      }));
    },
  };
}
