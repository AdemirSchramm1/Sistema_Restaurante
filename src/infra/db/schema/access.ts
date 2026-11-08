import { boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { base, editable } from "./common";
import { users } from "./auth";

export const roleEnum = pgEnum("role", ["MANAGER", "CHEF", "STOCKKEEPER", "BUYER", "ADMINISTRATIVE", "WAITER"]);
export const invitationStatusEnum = pgEnum("invitation_status", [
  "PENDING",
  "ACCEPTED",
  "REVOKED",
  "EXPIRED",
]);

export const restaurants = pgTable("restaurants", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  /** Chave "Recebendo pedidos pelo QR code" (spec 009, US6). */
  acceptingQrOrders: boolean("accepting_qr_orders").notNull().default(true),
  nextGroupCode: integer("next_group_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  createdBy: uuid("created_by"),
  ...editable,
});

export const memberships = pgTable("memberships", {
  ...base,
  ...editable,
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  active: boolean("active").notNull().default(true),
});

export const membershipRoles = pgTable(
  "membership_roles",
  {
    ...base,
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
  },
  (t) => [uniqueIndex("membership_roles_unique").on(t.membershipId, t.role)],
);

export const invitations = pgTable(
  "invitations",
  {
    ...base,
    ...editable,
    email: text("email").notNull(),
    roles: roleEnum("roles").array().notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: invitationStatusEnum("status").notNull().default("PENDING"),
  },
  (t) => [
    uniqueIndex("invitations_pending_email")
      .on(t.restaurantId, t.email)
      .where(sql`status = 'PENDING'`),
  ],
);
