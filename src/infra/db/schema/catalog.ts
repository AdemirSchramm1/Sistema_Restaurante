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
export const locationKindEnum = pgEnum("location_kind", [
  "DRY",
  "CHILLED",
  "FROZEN",
  "QUARANTINE",
  "IN_TRANSIT",
  "CHEMICALS",
  "STATION",
  "BAR",
  "NON_FOOD",
]);
export const itemTypeEnum = pgEnum("item_type", ["INGREDIENT", "RESALE", "PRODUCED", "CONSUMABLE", "ASSET"]);
export const countFrequencyEnum = pgEnum("count_frequency", [
  "SHIFT",
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "QUARTERLY",
]);

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

export const locations = pgTable(
  "locations",
  {
    ...base,
    ...editable,
    name: text("name").notNull(),
    kind: locationKindEnum("kind").notNull(),
    tempMinC: numeric("temp_min_c", { precision: 4, scale: 1 }),
    tempMaxC: numeric("temp_max_c", { precision: 4, scale: 1 }),
    responsibleUserId: uuid("responsible_user_id"),
    countOrder: integer("count_order").notNull().default(0),
    isSystem: boolean("is_system").notNull().default(false),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("locations_active_name")
      .on(t.restaurantId, sql`lower(${t.name})`)
      .where(sql`active`),
    uniqueIndex("locations_one_system_quarantine")
      .on(t.restaurantId)
      .where(sql`kind = 'QUARANTINE' and is_system`),
    check(
      "locations_temp_required",
      sql`kind not in ('CHILLED', 'FROZEN') or (temp_min_c is not null and temp_max_c is not null)`,
    ),
    check("locations_temp_order", sql`temp_min_c is null or temp_max_c is null or temp_min_c <= temp_max_c`),
    check("locations_count_order", sql`count_order >= 0`),
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
    recipeUnitId: uuid("recipe_unit_id")
      .notNull()
      .references(() => units.id),
    purchaseUnitLabel: text("purchase_unit_label").notNull(),
    purchaseFactor: numeric("purchase_factor", { precision: 14, scale: 4 }).notNull(),
    inCogsOverride: boolean("in_cogs_override"),
    eanUnit: text("ean_unit"),
    eanPackage: text("ean_package"),
    noGtin: boolean("no_gtin").notNull().default(false),
    financialCategory: text("financial_category"),
    presentation: text("presentation"),
    netWeight: numeric("net_weight", { precision: 14, scale: 4 }),
    drainedWeight: numeric("drained_weight", { precision: 14, scale: 4 }),
    catchWeight: boolean("catch_weight").notNull().default(false),
    correctionFactor: numeric("correction_factor", { precision: 8, scale: 4 }).notNull().default("1"),
    yieldFactor: numeric("yield_factor", { precision: 8, scale: 4 }),
    storageTempMaxC: numeric("storage_temp_max_c", { precision: 4, scale: 1 }),
    receivingTempMinC: numeric("receiving_temp_min_c", { precision: 4, scale: 1 }),
    receivingTempMaxC: numeric("receiving_temp_max_c", { precision: 4, scale: 1 }),
    shelfLifeDays: integer("shelf_life_days"),
    openedLifeDays: integer("opened_life_days"),
    lotControl: boolean("lot_control").notNull().default(false),
    expiryAlertDays: integer("expiry_alert_days"),
    allergens: text("allergens")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    ncm: text("ncm"),
    cest: text("cest"),
    origin: char("origin", { length: 1 }),
    taxGroup: text("tax_group"),
    countable: boolean("countable").notNull().default(true),
    countFrequency: countFrequencyEnum("count_frequency"),
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
    check("items_correction_factor", sql`correction_factor >= 1`),
    check("items_yield_factor", sql`yield_factor is null or (yield_factor > 0 and yield_factor <= 1)`),
  ],
);

export const itemUnitConversions = pgTable(
  "item_unit_conversions",
  {
    ...base,
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    fromUnitId: uuid("from_unit_id")
      .notNull()
      .references(() => units.id),
    toUnitId: uuid("to_unit_id")
      .notNull()
      .references(() => units.id),
    factor: numeric("factor", { precision: 14, scale: 4 }).notNull(),
  },
  () => [check("item_unit_conversions_factor", sql`factor > 0`)],
);

export const itemLocations = pgTable(
  "item_locations",
  {
    ...base,
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    isDefault: boolean("is_default").notNull().default(false),
    sheetPosition: integer("sheet_position").notNull(),
  },
  (t) => [
    uniqueIndex("item_locations_unique").on(t.itemId, t.locationId),
    uniqueIndex("item_locations_one_default")
      .on(t.itemId)
      .where(sql`is_default`),
    check("item_locations_position", sql`sheet_position >= 1`),
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
