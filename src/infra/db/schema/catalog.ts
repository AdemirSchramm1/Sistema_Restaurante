import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { base, editable } from "./common";

export const dimensionEnum = pgEnum("dimension", ["MASS", "VOLUME", "COUNT"]);
export const storageClassEnum = pgEnum("storage_class", ["FOOD", "CHEMICAL", "OTHER_NON_FOOD"]);
export const itemTypeEnum = pgEnum("item_type", ["INGREDIENT", "RESALE", "PRODUCED", "CONSUMABLE", "ASSET"]);

/** Catálogo global de unidades: sem restaurant_id, só leitura para a aplicação. */
export const units = pgTable("units", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull().unique(),
  dimension: dimensionEnum("dimension").notNull(),
  toBase: numeric("to_base", { precision: 14, scale: 4 }).notNull(),
  label: text("label").notNull(),
});

export const itemGroups = pgTable(
  "item_groups",
  {
    ...base,
    ...editable,
    code: char("code", { length: 2 }).notNull(),
    name: text("name").notNull(),
    storageClass: storageClassEnum("storage_class").notNull(),
    inCogs: boolean("in_cogs").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    active: boolean("active").notNull().default(true),
    nextSubgroupCode: integer("next_subgroup_code").notNull().default(1),
  },
  (t) => [
    uniqueIndex("item_groups_code").on(t.restaurantId, t.code),
    uniqueIndex("item_groups_active_name")
      .on(t.restaurantId, sql`lower(${t.name})`)
      .where(sql`active`),
  ],
);

export const itemSubgroups = pgTable(
  "item_subgroups",
  {
    ...base,
    ...editable,
    groupId: uuid("group_id")
      .notNull()
      .references(() => itemGroups.id),
    code: char("code", { length: 2 }).notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    nextItemSeq: integer("next_item_seq").notNull().default(1),
  },
  (t) => [
    uniqueIndex("item_subgroups_code").on(t.groupId, t.code),
    uniqueIndex("item_subgroups_active_name")
      .on(t.groupId, sql`lower(${t.name})`)
      .where(sql`active`),
  ],
);

export const items = pgTable(
  "items",
  {
    ...base,
    ...editable,
    code: text("code").notNull(),
    description: text("description").notNull(),
    descriptionNormalized: text("description_normalized").notNull(),
    type: itemTypeEnum("type").notNull(),
    subgroupId: uuid("subgroup_id")
      .notNull()
      .references(() => itemSubgroups.id),
    stockUnitId: uuid("stock_unit_id")
      .notNull()
      .references(() => units.id),
    stockUnitLockedAt: timestamp("stock_unit_locked_at", { withTimezone: true }),
    purchaseUnitLabel: text("purchase_unit_label"),
    purchaseFactor: numeric("purchase_factor", { precision: 14, scale: 4 }),
    inCogsOverride: boolean("in_cogs_override"),
    averageCost: numeric("average_cost", { precision: 14, scale: 4 }),
    lastCost: numeric("last_cost", { precision: 14, scale: 4 }),
    costUpdatedAt: timestamp("cost_updated_at", { withTimezone: true }),
    abcClass: char("abc_class", { length: 1 }),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("items_code").on(t.restaurantId, t.code),
    uniqueIndex("items_active_description")
      .on(t.restaurantId, t.subgroupId, t.descriptionNormalized)
      .where(sql`active`),
    index("items_description_trgm").using("gin", sql`${t.descriptionNormalized} gin_trgm_ops`),
    check("items_purchase_factor", sql`purchase_factor > 0`),
    check("items_purchase_pair", sql`(purchase_unit_label is null) = (purchase_factor is null)`),
  ],
);

export const auditActionEnum = pgEnum("audit_action", [
  "CREATE",
  "UPDATE",
  "DEACTIVATE",
  "REACTIVATE",
  "DENIED",
]);

/** Trilha de auditoria: só inserção (R10). */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey(),
    restaurantId: uuid("restaurant_id").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    action: auditActionEnum("action").notNull(),
    changes: jsonb("changes").notNull(),
    userId: uuid("user_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    origin: jsonb("origin").notNull(),
  },
  (t) => [index("audit_log_entity").on(t.restaurantId, t.entity, t.entityId, t.occurredAt)],
);
