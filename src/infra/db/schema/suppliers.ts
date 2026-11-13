import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { base, editable } from "./common";
import { items } from "./catalog";

/** Fornecedor: só dados comerciais (feature 007). Nunca é apagado; bloqueado = `active` falso. */
export const suppliers = pgTable(
  "suppliers",
  {
    ...base,
    ...editable,
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    legalName: text("legal_name"),
    cnpj: char("cnpj", { length: 14 }),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    deliveryDays: smallint("delivery_days")
      .array()
      .notNull()
      .default(sql`'{}'`),
    leadTimeDays: smallint("lead_time_days"),
    minOrderValue: numeric("min_order_value", { precision: 14, scale: 2 }),
    paymentTerms: text("payment_terms"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("suppliers_cnpj")
      .on(t.restaurantId, t.cnpj)
      .where(sql`cnpj is not null`),
    uniqueIndex("suppliers_active_name")
      .on(t.restaurantId, t.nameNormalized)
      .where(sql`active`),
    // Lista de fornecedores com os bloqueados (spec 012, R2).
    index("suppliers_restaurant_name").on(t.restaurantId, t.nameNormalized),
    check("suppliers_lead_time", sql`lead_time_days between 0 and 90`),
    check("suppliers_min_order", sql`min_order_value >= 0`),
    check("suppliers_delivery_days", sql`delivery_days <@ '{0,1,2,3,4,5,6}'::smallint[]`),
  ],
);

/** O que o fornecedor vende e por quanto. Configuração: pode ser removida (fica na auditoria). */
export const supplierItems = pgTable(
  "supplier_items",
  {
    ...base,
    ...editable,
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    packageLabel: text("package_label"),
    packageQuantity: numeric("package_quantity", { precision: 14, scale: 4 }),
    price: numeric("price", { precision: 14, scale: 4 }).notNull(),
    preferred: boolean("preferred").notNull().default(false),
  },
  (t) => [
    uniqueIndex("supplier_items_supplier_item").on(t.supplierId, t.itemId),
    uniqueIndex("supplier_items_preferred")
      .on(t.restaurantId, t.itemId)
      .where(sql`preferred`),
    index("supplier_items_item").on(t.restaurantId, t.itemId),
    check("supplier_items_price", sql`price > 0`),
    check("supplier_items_package_pair", sql`(package_label is null) = (package_quantity is null)`),
    check("supplier_items_package_quantity", sql`package_quantity > 0`),
  ],
);
