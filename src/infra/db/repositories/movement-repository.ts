import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { AdjustmentRequestRecord, MovementRecord, MovementRepo } from "@/application/inventory/ports";
import { d } from "@/domain/shared/decimal";
import type { Tx } from "../db";
import {
  adjustmentRequests,
  diningTables,
  items,
  orders,
  stockBalances,
  stockMovements,
  suppliers,
  users,
} from "../schema";
import { dec, str, UNIT_CODE_BY_ID } from "./util";

const recorder = alias(users, "recorder");
const approver = alias(users, "approver");
const decider = alias(users, "decider");
const reversal = alias(stockMovements, "reversal");

export function movementRepository(tx: Tx, restaurantId: string): MovementRepo {
  const movementSelect = () =>
    tx
      .select({
        m: stockMovements,
        itemName: items.description,
        stockUnitId: items.stockUnitId,
        recordedByName: recorder.name,
        approvedByName: approver.name,
        reversedById: reversal.id,
        supplierName: suppliers.name,
        orderNumber: orders.number,
        orderTableName: diningTables.name,
      })
      .from(stockMovements)
      .innerJoin(items, eq(items.id, stockMovements.itemId))
      .leftJoin(recorder, eq(recorder.id, stockMovements.createdBy))
      .leftJoin(approver, eq(approver.id, stockMovements.approvedBy))
      .leftJoin(reversal, eq(reversal.reversesId, stockMovements.id))
      .leftJoin(suppliers, eq(suppliers.id, stockMovements.supplierId))
      .leftJoin(orders, eq(orders.id, stockMovements.orderId))
      .leftJoin(diningTables, eq(diningTables.id, orders.tableId));

  type MovementRow = Awaited<ReturnType<ReturnType<typeof movementSelect>["execute"]>>[number];
  const toMovement = (r: MovementRow): MovementRecord => ({
    id: r.m.id,
    type: r.m.type,
    itemId: r.m.itemId,
    itemName: r.itemName,
    stockUnit: UNIT_CODE_BY_ID[r.stockUnitId]!,
    quantity: d(r.m.quantity),
    enteredQuantity: d(r.m.enteredQuantity),
    enteredUnit: r.m.enteredUnit,
    unitCost: d(r.m.unitCost),
    totalCost: d(r.m.totalCost),
    reasonId: r.m.reasonId,
    notes: r.m.notes,
    occurredAt: r.m.occurredAt,
    recordedAt: r.m.createdAt,
    recordedBy: r.m.createdBy,
    recordedByName: r.recordedByName,
    approvedBy: r.m.approvedBy,
    approvedByName: r.approvedByName,
    reversesId: r.m.reversesId,
    reversedById: r.reversedById,
    supplierId: r.m.supplierId,
    supplierName: r.supplierName,
    order:
      r.m.orderId && r.orderNumber !== null && r.orderTableName !== null
        ? { id: r.m.orderId, number: r.orderNumber, tableName: r.orderTableName }
        : null,
  });

  const requestSelect = () =>
    tx
      .select({
        r: adjustmentRequests,
        itemName: items.description,
        stockUnitId: items.stockUnitId,
        requestedByName: recorder.name,
        decidedByName: decider.name,
      })
      .from(adjustmentRequests)
      .innerJoin(items, eq(items.id, adjustmentRequests.itemId))
      .leftJoin(recorder, eq(recorder.id, adjustmentRequests.createdBy))
      .leftJoin(decider, eq(decider.id, adjustmentRequests.decidedBy));
  type RequestRow = Awaited<ReturnType<ReturnType<typeof requestSelect>["execute"]>>[number];
  const toRequest = (x: RequestRow): AdjustmentRequestRecord => ({
    id: x.r.id,
    itemId: x.r.itemId,
    itemName: x.itemName,
    stockUnit: UNIT_CODE_BY_ID[x.stockUnitId]!,
    countedQuantity: d(x.r.countedQuantity),
    systemQuantity: d(x.r.systemQuantity),
    difference: d(x.r.difference),
    reasonId: x.r.reasonId,
    notes: x.r.notes,
    status: x.r.status,
    requestedBy: x.r.createdBy!,
    requestedByName: x.requestedByName,
    requestedAt: x.r.createdAt,
    decidedBy: x.r.decidedBy,
    decidedByName: x.decidedByName,
    decidedAt: x.r.decidedAt,
    decisionNotes: x.r.decisionNotes,
    movementId: x.r.movementId,
    selfDecided: x.r.selfDecided,
  });

  return {
    async lockItem(itemId) {
      const [item] = await tx.select().from(items).where(eq(items.id, itemId)).for("update");
      if (!item) return null;
      await tx
        .insert(stockBalances)
        .values({ itemId, restaurantId, quantity: "0", updatedAt: new Date(0) })
        .onConflictDoNothing();
      const [b] = await tx.select().from(stockBalances).where(eq(stockBalances.itemId, itemId)).for("update");
      return {
        id: item.id,
        active: item.active,
        stockUnit: UNIT_CODE_BY_ID[item.stockUnitId]!,
        purchaseUnitLabel: item.purchaseUnitLabel,
        purchaseFactor: dec(item.purchaseFactor),
        averageCost: dec(item.averageCost),
        balance: d(b!.quantity),
      };
    },

    async insert(m) {
      await tx.insert(stockMovements).values({
        id: m.id,
        restaurantId,
        type: m.type,
        itemId: m.itemId,
        quantity: m.quantity.toString(),
        enteredQuantity: m.enteredQuantity.toString(),
        enteredUnit: m.enteredUnit,
        unitCost: m.unitCost.toString(),
        totalCost: m.totalCost.toString(),
        reasonId: m.reasonId,
        notes: m.notes,
        occurredAt: m.occurredAt,
        reversesId: m.reversesId,
        approvedBy: m.approvedBy,
        idempotencyKey: m.idempotencyKey,
        supplierId: m.supplierId ?? null,
        orderId: m.orderId ?? null,
        createdAt: m.recordedAt,
        createdBy: m.recordedBy,
      });
    },

    async addToBalance(itemId, delta, at) {
      await tx
        .update(stockBalances)
        .set({ quantity: sql`${stockBalances.quantity} + ${delta.toString()}`, updatedAt: at })
        .where(eq(stockBalances.itemId, itemId));
    },

    async setCosts(itemId, c) {
      await tx
        .update(items)
        .set({
          averageCost: c.averageCost.toString(),
          ...(c.lastCost ? { lastCost: str(c.lastCost) } : {}),
          costUpdatedAt: c.at,
        })
        .where(eq(items.id, itemId));
    },

    async lockStockUnit(itemId, at) {
      await tx
        .update(items)
        .set({ stockUnitLockedAt: at })
        .where(and(eq(items.id, itemId), sql`${items.stockUnitLockedAt} is null`));
    },

    async findByIdempotencyKey(key) {
      const [r] = await tx
        .select({ id: stockMovements.id })
        .from(stockMovements)
        .where(eq(stockMovements.idempotencyKey, key));
      return r?.id ?? null;
    },

    async salesForOrder(orderId) {
      const rows = await tx
        .select({
          id: stockMovements.id,
          itemId: stockMovements.itemId,
          quantity: stockMovements.quantity,
          unitCost: stockMovements.unitCost,
          totalCost: stockMovements.totalCost,
          reversedById: reversal.id,
        })
        .from(stockMovements)
        .leftJoin(reversal, eq(reversal.reversesId, stockMovements.id))
        .where(and(eq(stockMovements.orderId, orderId), eq(stockMovements.type, "SALE_RECIPE")))
        .orderBy(stockMovements.itemId);
      return rows.map((r) => ({
        id: r.id,
        itemId: r.itemId,
        quantity: d(r.quantity),
        unitCost: d(r.unitCost),
        totalCost: d(r.totalCost),
        reversed: r.reversedById !== null,
      }));
    },

    async get(id) {
      const [r] = await movementSelect().where(eq(stockMovements.id, id));
      return r ? toMovement(r) : null;
    },

    async list(f) {
      const where: SQL[] = [];
      if (f.itemId) where.push(eq(stockMovements.itemId, f.itemId));
      if (f.type) where.push(eq(stockMovements.type, f.type));
      const rows = await movementSelect()
        .where(where.length ? and(...where) : undefined)
        .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
        .limit(f.limit ?? 100);
      return rows.map(toMovement);
    },

    async insertRequest(r) {
      await tx.insert(adjustmentRequests).values({
        id: r.id,
        restaurantId,
        itemId: r.itemId,
        countedQuantity: r.countedQuantity.toString(),
        systemQuantity: r.systemQuantity.toString(),
        difference: r.difference.toString(),
        reasonId: r.reasonId,
        notes: r.notes,
        createdAt: r.at,
        createdBy: r.by,
        updatedAt: r.at,
        updatedBy: r.by,
      });
    },

    async lockRequest(id) {
      const [r] = await requestSelect()
        .where(eq(adjustmentRequests.id, id))
        .for("update", { of: adjustmentRequests });
      return r ? toRequest(r) : null;
    },

    async closeRequest(id, c) {
      await tx
        .update(adjustmentRequests)
        .set({
          status: c.status,
          decidedBy: c.by,
          decidedAt: c.at,
          decisionNotes: c.notes,
          movementId: c.movementId,
          selfDecided: c.selfDecided,
          updatedAt: c.at,
          updatedBy: c.by,
          version: sql`${adjustmentRequests.version} + 1`,
        })
        .where(and(eq(adjustmentRequests.id, id), eq(adjustmentRequests.status, "PENDING")));
    },

    async listRequests(status) {
      const rows = await requestSelect()
        .where(status === "ALL" ? undefined : eq(adjustmentRequests.status, status))
        .orderBy(desc(adjustmentRequests.createdAt));
      return rows.map(toRequest);
    },
  };
}
