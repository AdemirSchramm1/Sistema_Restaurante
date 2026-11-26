import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  BillingSettingsRepo,
  ClosedTabRow,
  TabPaymentRecord,
  TabRecord,
  TabRepo,
} from "@/application/billing/ports";
import { d } from "@/domain/shared/decimal";
import { err, ok } from "@/domain/shared/result";
import type { Tx } from "../db";
import {
  diningTables,
  orders,
  restaurants,
  tabEvents,
  tabPaymentRemovals,
  tabPayments,
  tableTabs,
  users,
} from "../schema";
import { dec, isUniqueViolation, str, withSavepoint } from "./util";
import { groupBy } from "@/domain/shared/collections";

const closer = alias(users, "closer");
const payer = alias(users, "payer");
const remover = alias(users, "remover");

export function tabRepository(tx: Tx, restaurantId: string, ids: () => string): TabRepo {
  const tabSelect = () =>
    tx
      .select({ t: tableTabs, tableName: diningTables.name, closedByName: closer.name })
      .from(tableTabs)
      .innerJoin(diningTables, eq(diningTables.id, tableTabs.tableId))
      .leftJoin(closer, eq(closer.id, tableTabs.closedBy));
  type TabRow = Awaited<ReturnType<ReturnType<typeof tabSelect>["execute"]>>[number];
  const toTab = ({ t, tableName, closedByName }: TabRow): TabRecord => ({
    id: t.id,
    tableId: t.tableId,
    tableName,
    status: t.status,
    openedAt: t.openedAt,
    serviceRate: dec(t.serviceRate),
    serviceWaived: t.serviceWaived,
    closedAt: t.closedAt,
    closedByName,
    closedDay: t.closedDay,
    closedTotals:
      t.subtotal && t.serviceCharge && t.total
        ? { subtotal: d(t.subtotal), serviceCharge: d(t.serviceCharge), total: d(t.total) }
        : null,
    version: t.version,
  });

  const paymentSelect = () =>
    tx
      .select({
        p: tabPayments,
        byName: payer.name,
        removedAt: tabPaymentRemovals.createdAt,
        removedByName: remover.name,
      })
      .from(tabPayments)
      .leftJoin(payer, eq(payer.id, tabPayments.createdBy))
      .leftJoin(tabPaymentRemovals, eq(tabPaymentRemovals.paymentId, tabPayments.id))
      .leftJoin(remover, eq(remover.id, tabPaymentRemovals.createdBy));
  type PaymentRow = Awaited<ReturnType<ReturnType<typeof paymentSelect>["execute"]>>[number];
  const toPayment = ({ p, byName, removedAt, removedByName }: PaymentRow): TabPaymentRecord => ({
    id: p.id,
    method: p.method,
    amount: d(p.amount),
    received: dec(p.received),
    change: dec(p.change),
    at: p.createdAt,
    byName,
    removedAt,
    removedByName,
  });

  const bump = (id: string, at: Date, by: string | null, set: Partial<typeof tableTabs.$inferInsert> = {}) =>
    tx
      .update(tableTabs)
      .set({ ...set, version: sql`${tableTabs.version} + 1`, updatedAt: at, updatedBy: by })
      .where(eq(tableTabs.id, id));

  const notRemoved = sql`not exists (select 1 from ${tabPaymentRemovals} r where r.payment_id = ${tabPayments.id})`;
  const closedIn = (f: { fromDay: string; toDay: string; tableId?: string }) =>
    and(
      eq(tableTabs.status, "CLOSED"),
      gte(tableTabs.closedDay, f.fromDay),
      lte(tableTabs.closedDay, f.toDay),
      f.tableId ? eq(tableTabs.tableId, f.tableId) : undefined,
    );

  return {
    async openForOrder(tableId, at, serviceRate) {
      // Um comando só: abre a conta ou, se a mesa já tem uma aberta, trava e soma 1 na versão dela.
      // Assim nenhum fechamento entra entre achar a conta e mexer nela.
      const id = ids();
      const [row] = await tx
        .insert(tableTabs)
        .values({
          id,
          restaurantId,
          createdAt: at,
          updatedAt: at,
          tableId,
          status: "OPEN",
          openedAt: at,
          serviceRate: str(serviceRate),
        })
        .onConflictDoUpdate({
          target: [tableTabs.restaurantId, tableTabs.tableId],
          targetWhere: sql`status = 'OPEN'`,
          set: { version: sql`${tableTabs.version} + 1`, updatedAt: at, updatedBy: null },
        })
        .returning({ id: tableTabs.id });
      return { id: row!.id, opened: row!.id === id };
    },

    async get(id) {
      const [r] = await tabSelect().where(eq(tableTabs.id, id));
      return r ? toTab(r) : null;
    },

    async lock(id) {
      const [r] = await tabSelect().where(eq(tableTabs.id, id)).for("update", { of: tableTabs });
      return r ? toTab(r) : null;
    },

    async touch(id, audit) {
      await bump(id, audit.at, audit.by);
    },

    async listOpen() {
      const tabs = await tx
        .select({
          id: tableTabs.id,
          tableId: tableTabs.tableId,
          tableName: diningTables.name,
          openedAt: tableTabs.openedAt,
          serviceRate: tableTabs.serviceRate,
          serviceWaived: tableTabs.serviceWaived,
          version: tableTabs.version,
        })
        .from(tableTabs)
        .innerJoin(diningTables, eq(diningTables.id, tableTabs.tableId))
        .where(eq(tableTabs.status, "OPEN"))
        .orderBy(asc(tableTabs.openedAt), asc(tableTabs.id));
      if (!tabs.length) return [];
      const tabIds = tabs.map((t) => t.id);
      const tabOrders = await tx
        .select({ tabId: orders.tabId, status: orders.status, total: orders.total })
        .from(orders)
        .where(inArray(orders.tabId, tabIds));
      const paid = await tx
        .select({
          tabId: tabPayments.tabId,
          amount: tabPayments.amount,
          removed: sql<boolean>`not ${notRemoved}`,
        })
        .from(tabPayments)
        .where(inArray(tabPayments.tabId, tabIds));
      const ordersByTab = groupBy(tabOrders, (o) => o.tabId);
      const paidByTab = groupBy(paid, (p) => p.tabId);
      return tabs.map((t) => ({
        ...t,
        serviceRate: dec(t.serviceRate),
        orders: (ordersByTab.get(t.id) ?? []).map((o) => ({ status: o.status, total: d(o.total) })),
        payments: (paidByTab.get(t.id) ?? []).map((p) => ({ amount: d(p.amount), removed: p.removed })),
      }));
    },

    async payments(tabId) {
      const rows = await paymentSelect()
        .where(eq(tabPayments.tabId, tabId))
        .orderBy(asc(tabPayments.createdAt), asc(tabPayments.id));
      return rows.map(toPayment);
    },

    async events(tabId) {
      const rows = await tx
        .select({
          kind: tabEvents.kind,
          reason: tabEvents.reason,
          details: tabEvents.details,
          userName: users.name,
          at: tabEvents.at,
        })
        .from(tabEvents)
        .leftJoin(users, eq(users.id, tabEvents.userId))
        .where(eq(tabEvents.tabId, tabId))
        .orderBy(asc(tabEvents.at), asc(tabEvents.id));
      return rows.map((r) => ({ ...r, details: (r.details as Record<string, unknown> | null) ?? null }));
    },

    async paymentByClientRequest(tabId, clientRequestId) {
      const [r] = await paymentSelect().where(
        and(eq(tabPayments.tabId, tabId), eq(tabPayments.clientRequestId, clientRequestId)),
      );
      return r ? toPayment(r) : null;
    },

    async getPayment(tabId, paymentId) {
      const [r] = await paymentSelect().where(
        and(eq(tabPayments.tabId, tabId), eq(tabPayments.id, paymentId)),
      );
      return r ? toPayment(r) : null;
    },

    async insertPayment(p, audit) {
      await tx.insert(tabPayments).values({
        id: p.id,
        restaurantId,
        createdAt: audit.at,
        createdBy: audit.by,
        tabId: p.tabId,
        method: p.method,
        amount: p.amount.toFixed(2),
        received: p.received?.toFixed(2) ?? null,
        change: p.change?.toFixed(2) ?? null,
        clientRequestId: p.clientRequestId,
        cashSessionId: p.cashSessionId,
      });
    },

    async removePayment(paymentId, id, cashSessionId, audit) {
      // A conta está travada e o caso de uso já viu que o pagamento não foi tirado; o índice
      // único tab_payment_removals_payment continua de guarda.
      await tx.insert(tabPaymentRemovals).values({
        id,
        restaurantId,
        createdAt: audit.at,
        createdBy: audit.by,
        paymentId,
        cashSessionId,
      });
    },

    async addEvent(e) {
      await tx.insert(tabEvents).values({
        id: e.id,
        restaurantId,
        createdAt: e.at,
        createdBy: e.userId,
        tabId: e.tabId,
        kind: e.kind,
        reason: e.reason ?? null,
        details: e.details ?? null,
        userId: e.userId,
        at: e.at,
      });
    },

    async setServiceWaived(id, waived, audit) {
      await bump(id, audit.at, audit.by, { serviceWaived: waived });
    },

    async close(id, s, audit) {
      await bump(id, audit.at, audit.by, {
        status: "CLOSED",
        closedAt: audit.at,
        closedBy: audit.by,
        closedDay: s.closedDay,
        subtotal: s.subtotal.toFixed(2),
        serviceCharge: s.serviceCharge.toFixed(2),
        total: s.total.toFixed(2),
        cashSessionId: s.cashSessionId,
      });
    },

    async countOpen() {
      const [r] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(tableTabs)
        .where(and(eq(tableTabs.restaurantId, restaurantId), eq(tableTabs.status, "OPEN")));
      return r!.n;
    },

    async reopen(id, audit) {
      try {
        await withSavepoint(tx, () =>
          bump(id, audit.at, audit.by, {
            status: "OPEN",
            closedAt: null,
            closedBy: null,
            closedDay: null,
            subtotal: null,
            serviceCharge: null,
            total: null,
          }),
        );
        return ok(undefined);
      } catch (e) {
        if (isUniqueViolation(e, "table_tabs_one_open")) return err("TABLE_HAS_OPEN_TAB");
        throw e;
      }
    },

    async listClosed(f) {
      const rows = await tabSelect().where(closedIn(f)).orderBy(desc(tableTabs.closedAt), desc(tableTabs.id));
      return rows.map((r): ClosedTabRow => {
        const t = toTab(r);
        return {
          id: t.id,
          tableId: t.tableId,
          tableName: t.tableName,
          openedAt: t.openedAt,
          closedAt: t.closedAt!,
          closedDay: t.closedDay!,
          closedByName: t.closedByName,
          ...t.closedTotals!,
        };
      });
    },

    async paidByMethod(f) {
      const rows = await tx
        .select({ method: tabPayments.method, amount: sql<string>`sum(${tabPayments.amount})` })
        .from(tabPayments)
        .innerJoin(tableTabs, eq(tableTabs.id, tabPayments.tabId))
        .where(and(closedIn(f), notRemoved))
        .groupBy(tabPayments.method);
      return rows.map((r) => ({ method: r.method, amount: d(r.amount) }));
    },
  };
}

export function billingSettingsRepository(tx: Tx, restaurantId: string): BillingSettingsRepo {
  return {
    async get() {
      const [r] = await tx
        .select({ rate: restaurants.serviceChargeRate, version: restaurants.version })
        .from(restaurants)
        .where(eq(restaurants.id, restaurantId));
      if (!r) throw new Error("restaurante não encontrado");
      return { serviceChargeRate: dec(r.rate), version: r.version };
    },
    async setServiceChargeRate(rate, version, audit) {
      const r = await tx
        .update(restaurants)
        .set({ serviceChargeRate: str(rate), version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
        .where(and(eq(restaurants.id, restaurantId), eq(restaurants.version, version)))
        .returning({ id: restaurants.id });
      return r.length ? ok(undefined) : err("STALE_RECORD");
    },
  };
}
