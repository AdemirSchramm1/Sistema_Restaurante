import { integer, timestamp, uuid } from "drizzle-orm/pg-core";

/** id, restaurante e criação: presentes em toda tabela de negócio. */
export const base = {
  id: uuid("id").primaryKey(),
  restaurantId: uuid("restaurant_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  createdBy: uuid("created_by"),
};

/** Colunas de tabelas editáveis (trava otimista em `version`). */
export const editable = {
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  updatedBy: uuid("updated_by"),
  version: integer("version").notNull().default(1),
};
