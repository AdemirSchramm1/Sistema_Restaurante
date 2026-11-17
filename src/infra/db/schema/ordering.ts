import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { base, editable } from "./common";
import { users } from "./auth";
import { items, recipes, recipeVersions, units } from "./catalog";
import { tableTabs } from "./billing";

/** Pedidos pelo QR code da mesa (feature 009, specs/009-pedidos-qr-mesa/data-model.md). */

export const orderStatusEnum = pgEnum("order_status", [
  "RECEIVED",
  "PREPARING",
  "READY",
  "DELIVERED",
  "CANCELLED",
]);
/** Por que o acesso ao cardápio acabou antes dos 20 minutos (spec 011). */
export const menuAccessEndReasonEnum = pgEnum("menu_access_end_reason", ["RESCAN", "TAB_CLOSED"]);
export const orderCancelReasonEnum = pgEnum("order_cancel_reason", [
  "CUSTOMER_GAVE_UP",
  "OUT_OF_PRODUCT",
  "IMPROPER_ORDER",
  "ENTERED_BY_MISTAKE",
  "OTHER",
]);
/** De onde veio o pedido (spec 015): o cliente pelo QR code ou alguém da equipe. */
export const orderSourceEnum = pgEnum("order_source", ["QR", "STAFF"]);

/** Mesa. O token do link fica em texto: está impresso na mesa (research R1). */
export const diningTables = pgTable(
  "dining_tables",
  {
    ...base,
    ...editable,
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    active: boolean("active").notNull().default(true),
    qrToken: text("qr_token").notNull().unique(),
    qrRotatedAt: timestamp("qr_rotated_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("dining_tables_active_name")
      .on(t.restaurantId, t.nameNormalized)
      .where(sql`active`),
    // Lista de mesas com as inativas (spec 012, R2).
    index("dining_tables_restaurant").on(t.restaurantId, t.nameNormalized),
    check("dining_tables_name_length", sql`char_length(name) between 1 and 30`),
  ],
);

/** Acesso ao cardápio: 20 minutos desde a leitura do QR code (research R2). */
export const menuAccesses = pgTable(
  "menu_accesses",
  {
    ...base,
    tableId: uuid("table_id")
      .notNull()
      .references(() => diningTables.id),
    tokenHash: text("token_hash").notNull().unique(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endReason: menuAccessEndReasonEnum("end_reason"),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("menu_accesses_open").on(t.restaurantId, t.expiresAt),
    index("menu_accesses_table").on(t.restaurantId, t.tableId, t.expiresAt),
    check("menu_accesses_twenty_minutes", sql`expires_at = opened_at + interval '20 minutes'`),
    check("menu_accesses_end_reason", sql`(ended_at is null) = (end_reason is null)`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    ...base,
    tableId: uuid("table_id")
      .notNull()
      .references(() => diningTables.id),
    /** Só no pedido pelo QR code (spec 015). */
    menuAccessId: uuid("menu_access_id").references(() => menuAccesses.id),
    clientRequestId: uuid("client_request_id").notNull(),
    businessDay: date("business_day", { mode: "string" }).notNull(),
    number: integer("number").notNull(),
    status: orderStatusEnum("status").notNull(),
    cancelReason: orderCancelReasonEnum("cancel_reason"),
    cancelNote: text("cancel_note"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull(),
    version: integer("version").notNull().default(1),
    /** Conta da mesa (spec 011); nula só nos pedidos de antes da 011. */
    tabId: uuid("tab_id").references(() => tableTabs.id),
    /** Origem e quem lançou (spec 015, FR-006); nunca mudam. */
    source: orderSourceEnum("source").notNull().default("QR"),
    placedBy: uuid("placed_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("orders_client_request").on(t.menuAccessId, t.clientRequestId),
    uniqueIndex("orders_staff_client_request")
      .on(t.restaurantId, t.placedBy, t.clientRequestId)
      .where(sql`source = 'STAFF'`),
    index("orders_placed_by")
      .on(t.restaurantId, t.placedBy, t.businessDay)
      .where(sql`source = 'STAFF'`),
    check(
      "orders_source_shape",
      sql`(source = 'QR' and menu_access_id is not null and placed_by is null) or (source = 'STAFF' and menu_access_id is null and placed_by is not null)`,
    ),
    index("orders_tab").on(t.tabId),
    uniqueIndex("orders_day_number").on(t.restaurantId, t.businessDay, t.number),
    index("orders_open").on(t.restaurantId, t.status, t.submittedAt),
    index("orders_day").on(t.restaurantId, t.businessDay),
    check("orders_total_positive", sql`total > 0`),
    check("orders_cancel_reason", sql`(status = 'CANCELLED') = (cancel_reason is not null)`),
    check("orders_cancel_note", sql`cancel_reason is distinct from 'OTHER' or cancel_note is not null`),
    check("orders_cancel_note_length", sql`char_length(cancel_note) <= 140`),
  ],
);

/** Linha do pedido: só inserção. Escolhas (adicionais e retiradas) na feature 010. */
export const orderLines = pgTable(
  "order_lines",
  {
    ...base,
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    position: smallint("position").notNull(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id),
    recipeVersionId: uuid("recipe_version_id")
      .notNull()
      .references(() => recipeVersions.id),
    quantity: smallint("quantity").notNull(),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    /** Observação para a cozinha, só da equipe (spec 015, FR-018). */
    kitchenNote: text("kitchen_note"),
  },
  (t) => [
    uniqueIndex("order_lines_position").on(t.orderId, t.position),
    check("order_lines_kitchen_note", sql`char_length(kitchen_note) between 1 and 140`),
    check("order_lines_quantity", sql`quantity between 1 and 20`),
    check("order_lines_base_price", sql`base_price > 0`),
    check("order_lines_unit_price", sql`unit_price >= base_price`),
  ],
);

/** Cada mudança de situação: só inserção. */
export const orderStatusEvents = pgTable(
  "order_status_events",
  {
    ...base,
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    reason: orderCancelReasonEnum("reason"),
    userId: uuid("user_id"),
    at: timestamp("at", { withTimezone: true }).notNull(),
  },
  (t) => [index("order_status_events_order").on(t.orderId, t.at)],
);

/** Número do pedido por restaurante e dia (research R6). */
export const orderDayCounters = pgTable(
  "order_day_counters",
  {
    restaurantId: uuid("restaurant_id").notNull(),
    businessDay: date("business_day", { mode: "string" }).notNull(),
    lastNumber: integer("last_number").notNull(),
  },
  (t) => [primaryKey({ columns: [t.restaurantId, t.businessDay] })],
);

/** Adicionais e retiradas por botão (feature 010, specs/010-adicionais-retiradas/data-model.md). */

/** Adicional: item ou preparo com quantidade e preço (zero = "Grátis"). */
export const addons = pgTable(
  "addons",
  {
    ...base,
    ...editable,
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    itemId: uuid("item_id").references(() => items.id),
    subRecipeId: uuid("sub_recipe_id").references(() => recipes.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("addons_active_name")
      .on(t.restaurantId, t.nameNormalized)
      .where(sql`active`),
    // Lista de adicionais com os inativos (spec 012, R2).
    index("addons_restaurant_name").on(t.restaurantId, t.nameNormalized),
    check("addons_one_component", sql`(item_id is null) <> (sub_recipe_id is null)`),
    check("addons_quantity_positive", sql`quantity > 0`),
    check("addons_price", sql`price >= 0`),
    check("addons_name_length", sql`char_length(name) between 1 and 40`),
  ],
);

/** O que o produto pode adicionar, com o máximo de vezes por unidade. */
export const recipeAddons = pgTable(
  "recipe_addons",
  {
    ...base,
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id),
    addonId: uuid("addon_id")
      .notNull()
      .references(() => addons.id),
    maxTimes: smallint("max_times").notNull(),
    position: smallint("position").notNull(),
  },
  (t) => [
    uniqueIndex("recipe_addons_unique").on(t.recipeId, t.addonId),
    check("recipe_addons_max_times", sql`max_times between 1 and 5`),
  ],
);

/** O que o produto pode tirar: preso ao componente, não à linha (research R1). */
export const recipeRemovables = pgTable(
  "recipe_removables",
  {
    ...base,
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id),
    itemId: uuid("item_id").references(() => items.id),
    subRecipeId: uuid("sub_recipe_id").references(() => recipes.id),
    label: text("label").notNull(),
    position: smallint("position").notNull(),
  },
  (t) => [
    uniqueIndex("recipe_removables_item")
      .on(t.recipeId, t.itemId)
      .where(sql`item_id is not null`),
    uniqueIndex("recipe_removables_sub_recipe")
      .on(t.recipeId, t.subRecipeId)
      .where(sql`sub_recipe_id is not null`),
    // Os dois únicos acima são parciais e não servem para "retiradas do produto" (spec 012, R2).
    index("recipe_removables_recipe").on(t.recipeId, t.position),
    check("recipe_removables_one_component", sql`(item_id is null) <> (sub_recipe_id is null)`),
    check("recipe_removables_label", sql`char_length(label) between 1 and 40`),
  ],
);

/** Adicional escolhido na linha do pedido, com cópia do envio. Só inserção. */
export const orderLineAddons = pgTable(
  "order_line_addons",
  {
    ...base,
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => orderLines.id),
    addonId: uuid("addon_id")
      .notNull()
      .references(() => addons.id),
    name: text("name").notNull(),
    times: smallint("times").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    itemId: uuid("item_id").references(() => items.id),
    subRecipeId: uuid("sub_recipe_id").references(() => recipes.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id),
  },
  (t) => [
    uniqueIndex("order_line_addons_unique").on(t.orderLineId, t.addonId),
    check("order_line_addons_times", sql`times between 1 and 5`),
    check("order_line_addons_price", sql`unit_price >= 0`),
    check("order_line_addons_one_component", sql`(item_id is null) <> (sub_recipe_id is null)`),
  ],
);

/** Retirada escolhida na linha do pedido. Só inserção. */
export const orderLineRemovals = pgTable(
  "order_line_removals",
  {
    ...base,
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => orderLines.id),
    itemId: uuid("item_id").references(() => items.id),
    subRecipeId: uuid("sub_recipe_id").references(() => recipes.id),
    label: text("label").notNull(),
  },
  (t) => [
    uniqueIndex("order_line_removals_item")
      .on(t.orderLineId, t.itemId)
      .where(sql`item_id is not null`),
    uniqueIndex("order_line_removals_sub_recipe")
      .on(t.orderLineId, t.subRecipeId)
      .where(sql`sub_recipe_id is not null`),
    // Os dois únicos acima são parciais e não servem para "retiradas da linha" (spec 012, R2).
    index("order_line_removals_line").on(t.orderLineId),
    check("order_line_removals_one_component", sql`(item_id is null) <> (sub_recipe_id is null)`),
  ],
);
