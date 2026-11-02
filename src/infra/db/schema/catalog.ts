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
    // 8 casas: o estorno de compra refaz a média sem acumular erro de arredondamento (spec 004).
    averageCost: numeric("average_cost", { precision: 18, scale: 8 }),
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

export const recipeKindEnum = pgEnum("recipe_kind", ["DISH", "SUB_RECIPE"]);

/** Produto (o que o cliente pede) ou preparo usado dentro de outros produtos (feature 003). */
export const recipes = pgTable(
  "recipes",
  {
    ...base,
    ...editable,
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    kind: recipeKindEnum("kind").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("recipes_active_name")
      .on(t.restaurantId, t.nameNormalized)
      .where(sql`active`),
  ],
);

/** Versão do produto: só inserção. O rendimento só existe no preparo. */
export const recipeVersions = pgTable(
  "recipe_versions",
  {
    ...base,
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id),
    number: integer("number").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    yieldQuantity: numeric("yield_quantity", { precision: 14, scale: 4 }),
    yieldUnitId: uuid("yield_unit_id").references(() => units.id),
  },
  (t) => [
    uniqueIndex("recipe_versions_number").on(t.recipeId, t.number),
    check("recipe_versions_yield_pair", sql`(yield_quantity is null) = (yield_unit_id is null)`),
    check("recipe_versions_yield_positive", sql`yield_quantity > 0`),
  ],
);

/** Linha da versão: um item ou um preparo, com quantidade e medida. Só inserção. */
export const recipeLines = pgTable(
  "recipe_lines",
  {
    ...base,
    recipeVersionId: uuid("recipe_version_id")
      .notNull()
      .references(() => recipeVersions.id),
    position: integer("position").notNull(),
    itemId: uuid("item_id").references(() => items.id),
    subRecipeId: uuid("sub_recipe_id").references(() => recipes.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id),
  },
  (t) => [
    uniqueIndex("recipe_lines_position").on(t.recipeVersionId, t.position),
    uniqueIndex("recipe_lines_item")
      .on(t.recipeVersionId, t.itemId)
      .where(sql`item_id is not null`),
    uniqueIndex("recipe_lines_sub_recipe")
      .on(t.recipeVersionId, t.subRecipeId)
      .where(sql`sub_recipe_id is not null`),
    index("recipe_lines_sub_recipe_lookup").on(t.subRecipeId),
    check("recipe_lines_one_component", sql`(item_id is null) <> (sub_recipe_id is null)`),
    check("recipe_lines_quantity_positive", sql`quantity > 0`),
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
