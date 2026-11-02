import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { base, editable } from "./common";
import { items } from "./catalog";
import { suppliers } from "./suppliers";

/** Livro de movimentações (feature 004, docs/sistema/estoque/03-movimentacoes-e-saldo.md). */
export const movementTypeEnum = pgEnum("movement_type", ["PURCHASE", "LOSS", "ADJUSTMENT", "REVERSAL"]);
export const adjustmentStatusEnum = pgEnum("adjustment_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

/** Motivos em lista fechada: globais, só leitura (seed na migração 0005). */
export const movementReasons = pgTable("movement_reasons", {
  id: uuid("id").primaryKey(),
  movementType: movementTypeEnum("movement_type").notNull(),
  code: text("code").notNull(),
  label: text("label").notNull(),
  family: text("family").notNull(),
  position: integer("position").notNull(),
});

/** Só inserção. Quantidade e total com sinal, na medida do item. */
export const stockMovements = pgTable(
  "stock_movements",
  {
    ...base,
    type: movementTypeEnum("type").notNull(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    enteredQuantity: numeric("entered_quantity", { precision: 14, scale: 4 }).notNull(),
    enteredUnit: text("entered_unit").notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 4 }).notNull(),
    totalCost: numeric("total_cost", { precision: 14, scale: 2 }).notNull(),
    reasonId: uuid("reason_id").references(() => movementReasons.id),
    notes: text("notes"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    reversesId: uuid("reverses_id"),
    approvedBy: uuid("approved_by"),
    idempotencyKey: text("idempotency_key"),
    /** De quem foi a compra (feature 007). Só na compra. */
    supplierId: uuid("supplier_id").references(() => suppliers.id),
  },
  (t) => [
    uniqueIndex("stock_movements_reverses")
      .on(t.reversesId)
      .where(sql`reverses_id is not null`),
    uniqueIndex("stock_movements_idempotency")
      .on(t.restaurantId, t.idempotencyKey)
      .where(sql`idempotency_key is not null`),
    index("stock_movements_item").on(t.restaurantId, t.itemId, t.createdAt),
    index("stock_movements_recorded").on(t.restaurantId, t.createdAt),
    check("stock_movements_reason", sql`(type = 'PURCHASE') = (reason_id is null)`),
    check("stock_movements_reversal", sql`(type = 'REVERSAL') = (reverses_id is not null)`),
    check("stock_movements_purchase_in", sql`type <> 'PURCHASE' or quantity > 0`),
    check("stock_movements_loss_out", sql`type <> 'LOSS' or quantity < 0`),
    check("stock_movements_not_zero", sql`quantity <> 0`),
    check("stock_movements_supplier_purchase", sql`supplier_id is null or type = 'PURCHASE'`),
    index("stock_movements_supplier").on(t.restaurantId, t.supplierId, t.itemId, t.createdAt),
  ],
);

/** Projeção do saldo: soma do livro por item, atualizada na mesma transação. */
export const stockBalances = pgTable("stock_balances", {
  itemId: uuid("item_id")
    .primaryKey()
    .references(() => items.id),
  restaurantId: uuid("restaurant_id").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/** Pedido de acerto: só vale depois de aprovado por outra pessoa (decisão do dono, spec 004 US3). */
export const adjustmentRequests = pgTable(
  "adjustment_requests",
  {
    ...base,
    ...editable,
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    countedQuantity: numeric("counted_quantity", { precision: 14, scale: 4 }).notNull(),
    systemQuantity: numeric("system_quantity", { precision: 14, scale: 4 }).notNull(),
    difference: numeric("difference", { precision: 14, scale: 4 }).notNull(),
    reasonId: uuid("reason_id")
      .notNull()
      .references(() => movementReasons.id),
    notes: text("notes"),
    status: adjustmentStatusEnum("status").notNull().default("PENDING"),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNotes: text("decision_notes"),
    movementId: uuid("movement_id").references(() => stockMovements.id),
  },
  (t) => [
    index("adjustment_requests_status").on(t.restaurantId, t.status, t.createdAt),
    check(
      "adjustment_requests_other_decider",
      sql`decided_by is null or decided_by <> created_by or status = 'CANCELLED'`,
    ),
    check("adjustment_requests_difference", sql`difference <> 0`),
  ],
);
