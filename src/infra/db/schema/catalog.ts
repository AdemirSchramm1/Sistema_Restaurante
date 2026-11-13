import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
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
    // Árvore de grupos do restaurante (spec 012, R2).
    index("item_subgroups_restaurant_code").on(t.restaurantId, t.code),
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
    /** Aviso de reposição (feature 006), na medida do item: "avisar quando chegar em" e "comprar até". */
    reorderPoint: numeric("reorder_point", { precision: 14, scale: 4 }),
    parLevel: numeric("par_level", { precision: 14, scale: 4 }),
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
    check("items_reorder_point", sql`reorder_point >= 0`),
    check(
      "items_par_level",
      sql`par_level is null or (reorder_point is not null and par_level > reorder_point)`,
    ),
  ],
);

export const recipeKindEnum = pgEnum("recipe_kind", ["DISH", "SUB_RECIPE"]);

/** Seção do cardápio: Entradas, Lanches, Bebidas… (spec 013, US2). É apagada de verdade. */
export const menuSections = pgTable(
  "menu_sections",
  {
    ...base,
    ...editable,
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    /** Ordem no cardápio, densa (1..n). A unicidade é adiável (migração 0013) para trocar vizinhas. */
    position: integer("position").notNull(),
  },
  (t) => [
    uniqueIndex("menu_sections_name").on(t.restaurantId, t.nameNormalized),
    // Alvo da chave composta de recipes: a seção é sempre do mesmo restaurante do produto.
    uniqueIndex("menu_sections_id_restaurant").on(t.id, t.restaurantId),
    check("menu_sections_name_length", sql`char_length(name) between 1 and 40`),
    check("menu_sections_position_positive", sql`position > 0`),
  ],
);

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
    /** Preço de venda; só produto vendido (spec 008). */
    salePrice: numeric("sale_price", { precision: 12, scale: 2 }),
    /** "Esgotado hoje": data local em que foi marcado (spec 009, US5). */
    soldOutOn: date("sold_out_on", { mode: "string" }),
    /** Cardápio (spec 013). Fora da versão do produto: mudar não cria versão. */
    description: text("description"),
    /** Nulo = sem seção ("Outros"). */
    menuSectionId: uuid("menu_section_id"),
    /** Posição na seção, densa (1..n) entre os vendidos; 0 no preparo. */
    menuPosition: integer("menu_position").notNull().default(0),
    /** Endereço da foto até o identificador, sem a largura: `…/menu/{photoId}`. */
    photoBase: text("photo_base"),
    /** Larguras gravadas da foto, em ordem crescente. */
    photoWidths: smallint("photo_widths").array(),
  },
  (t) => [
    foreignKey({
      name: "recipes_menu_section_fk",
      columns: [t.menuSectionId, t.restaurantId],
      foreignColumns: [menuSections.id, menuSections.restaurantId],
    }),
    check("recipes_description_length", sql`char_length(description) between 1 and 300`),
    check(
      "recipes_photo_pair",
      sql`(photo_base is null) = (photo_widths is null) and (photo_widths is null or cardinality(photo_widths) >= 1)`,
    ),
    check(
      "recipes_menu_only_dish",
      sql`kind = 'DISH' or (description is null and menu_section_id is null and menu_position = 0 and photo_base is null and photo_widths is null)`,
    ),
    uniqueIndex("recipes_active_name")
      .on(t.restaurantId, t.nameNormalized)
      .where(sql`active`),
    // Cardápio e listas por tipo, ativos ou não (spec 012, R2).
    index("recipes_kind_name").on(t.restaurantId, t.kind, t.nameNormalized),
    // Tela Cardápio e cardápio do cliente: produtos por seção e posição (spec 013).
    index("recipes_menu_order").on(t.restaurantId, t.kind, t.menuSectionId, t.menuPosition),
    check("recipes_sale_price_positive", sql`sale_price > 0`),
    check("recipes_sale_price_dish", sql`sale_price is null or kind = 'DISH'`),
    check("recipes_sold_out_dish", sql`sold_out_on is null or kind = 'DISH'`),
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
