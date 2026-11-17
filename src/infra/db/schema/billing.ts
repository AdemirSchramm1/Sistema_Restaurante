import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
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
import { diningTables } from "./ordering";
import { cashSessions } from "./cash";

/** Conta da mesa e pagamentos (feature 011, specs/011-fechamento-conta-mesa/data-model.md). */

export const tabStatusEnum = pgEnum("tab_status", ["OPEN", "CLOSED"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "PIX",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "OTHER",
]);
export const tabEventKindEnum = pgEnum("tab_event_kind", [
  "OPENED",
  "PAYMENT_ADDED",
  "PAYMENT_REMOVED",
  "SERVICE_WAIVED",
  "SERVICE_RESTORED",
  "CLOSED",
  "REOPENED",
]);

/**
 * Conta da mesa: abre no primeiro pedido e recebe os pedidos da mesa até fechar. Uma aberta por mesa.
 * Ao fechar guarda quem, quando, o dia local e os valores (retrato para a consulta).
 */
export const tableTabs = pgTable(
  "table_tabs",
  {
    ...base,
    ...editable,
    tableId: uuid("table_id")
      .notNull()
      .references(() => diningTables.id),
    status: tabStatusEnum("status").notNull().default("OPEN"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    /** Copiada do restaurante ao abrir; nula = sem taxa. */
    serviceRate: numeric("service_rate", { precision: 5, scale: 2 }),
    serviceWaived: boolean("service_waived").notNull().default(false),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: uuid("closed_by"),
    closedDay: date("closed_day", { mode: "string" }),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }),
    serviceCharge: numeric("service_charge", { precision: 12, scale: 2 }),
    total: numeric("total", { precision: 12, scale: 2 }),
    /** Turno do caixa aberto quando a conta fechou (spec 014); nulo antes da 014 e na conta de R$ 0,00. */
    cashSessionId: uuid("cash_session_id").references(() => cashSessions.id),
  },
  (t) => [
    index("table_tabs_cash_session").on(t.cashSessionId),
    uniqueIndex("table_tabs_one_open")
      .on(t.restaurantId, t.tableId)
      .where(sql`status = 'OPEN'`),
    index("table_tabs_closed_day").on(t.restaurantId, t.closedDay),
    check("table_tabs_service_rate", sql`service_rate between 0 and 20`),
    check(
      "table_tabs_closed",
      sql`num_nonnulls(closed_at, closed_by, closed_day, subtotal, service_charge, total) = case when status = 'CLOSED' then 6 else 0 end`,
    ),
    check("table_tabs_total", sql`total = subtotal + service_charge`),
  ],
);

/** Pagamento: só inserção. Tirar é outra linha (`tab_payment_removals`). */
export const tabPayments = pgTable(
  "tab_payments",
  {
    ...base,
    tabId: uuid("tab_id")
      .notNull()
      .references(() => tableTabs.id),
    method: paymentMethodEnum("method").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    received: numeric("received", { precision: 12, scale: 2 }),
    change: numeric("change", { precision: 12, scale: 2 }),
    clientRequestId: uuid("client_request_id").notNull(),
    /** Turno do caixa em que entrou (spec 014). Obrigatório em linha nova; nulo só nas de antes da 014. */
    cashSessionId: uuid("cash_session_id").references(() => cashSessions.id),
  },
  (t) => [
    index("tab_payments_cash_session").on(t.cashSessionId, t.method),
    check("tab_payments_cash_session", sql`cash_session_id is not null`),
    uniqueIndex("tab_payments_client_request").on(t.tabId, t.clientRequestId),
    check("tab_payments_amount", sql`amount > 0`),
    check("tab_payments_by", sql`created_by is not null`),
    check(
      "tab_payments_cash",
      sql`case when method = 'CASH' then received is not null and change >= 0 and received = amount + change else received is null and change is null end`,
    ),
  ],
);

/** Pagamento tirado (lançado errado): só inserção, uma vez por pagamento. */
export const tabPaymentRemovals = pgTable(
  "tab_payment_removals",
  {
    ...base,
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => tabPayments.id),
    /** Turno do caixa em que foi tirado (spec 014). Obrigatório em linha nova. */
    cashSessionId: uuid("cash_session_id").references(() => cashSessions.id),
  },
  (t) => [
    index("tab_payment_removals_cash_session").on(t.cashSessionId),
    check("tab_payment_removals_cash_session", sql`cash_session_id is not null`),
    uniqueIndex("tab_payment_removals_payment").on(t.paymentId),
    check("tab_payment_removals_by", sql`created_by is not null`),
  ],
);

/** Histórico da conta: só inserção. */
export const tabEvents = pgTable(
  "tab_events",
  {
    ...base,
    tabId: uuid("tab_id")
      .notNull()
      .references(() => tableTabs.id),
    kind: tabEventKindEnum("kind").notNull(),
    reason: text("reason"),
    details: jsonb("details"),
    userId: uuid("user_id"),
    at: timestamp("at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("tab_events_tab").on(t.tabId, t.at),
    check("tab_events_reason", sql`(kind = 'REOPENED') = (reason is not null)`),
    check("tab_events_reason_length", sql`char_length(reason) between 1 and 140`),
    check("tab_events_user", sql`kind = 'OPENED' or user_id is not null`),
  ],
);
