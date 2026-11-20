import { sql } from "drizzle-orm";
import {
  check,
  date,
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
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { base, editable } from "./common";

/** Caixa do dia (feature 014, specs/014-fechamento-caixa/data-model.md). */

export const cashSessionStatusEnum = pgEnum("cash_session_status", ["OPEN", "CLOSED"]);
export const cashEntryKindEnum = pgEnum("cash_entry_kind", ["WITHDRAWAL", "SUPPLY"]);
export const cashWithdrawalReasonEnum = pgEnum("cash_withdrawal_reason", [
  "SAFE",
  "SUPPLIER_PAYMENT",
  "DAILY_EXPENSE",
  "OTHER",
]);

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

/**
 * Turno do caixa: um aberto por restaurante. Ao fechar guarda o retrato da conferência (esperado,
 * contado, diferença, o que ficou na gaveta e a taxa das contas fechadas no turno) e não muda mais.
 */
export const cashSessions = pgTable(
  "cash_sessions",
  {
    ...base,
    ...editable,
    status: cashSessionStatusEnum("status").notNull().default("OPEN"),
    /** Dia do restaurante na abertura. */
    businessDay: date("business_day", { mode: "string" }).notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    openedBy: uuid("opened_by").notNull(),
    openingFloat: money("opening_float").notNull(),
    /** O que ficou na gaveta no último turno fechado; nulo no primeiro turno. */
    previousKept: money("previous_kept"),
    openingNote: text("opening_note"),
    /** Gerado pela tela: o toque duplo em "Abrir caixa" devolve o mesmo turno. */
    clientRequestId: uuid("client_request_id").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: uuid("closed_by"),
    expected: money("expected"),
    counted: money("counted"),
    difference: money("difference"),
    kept: money("kept"),
    serviceCharge: money("service_charge"),
    closingCountId: uuid("closing_count_id").references((): AnyPgColumn => cashCounts.id),
    closeNote: text("close_note"),
  },
  (t) => [
    uniqueIndex("cash_sessions_one_open")
      .on(t.restaurantId)
      .where(sql`status = 'OPEN'`),
    index("cash_sessions_day").on(t.restaurantId, t.businessDay),
    check("cash_sessions_opening_float", sql`opening_float >= 0`),
    check("cash_sessions_opening_note_length", sql`char_length(opening_note) between 1 and 140`),
    check(
      "cash_sessions_opening_note",
      sql`previous_kept is null or previous_kept = opening_float or opening_note is not null`,
    ),
    check(
      "cash_sessions_closed",
      sql`num_nonnulls(closed_at, closed_by, expected, counted, difference, kept, service_charge, closing_count_id) = case when status = 'CLOSED' then 8 else 0 end`,
    ),
    check("cash_sessions_difference", sql`difference = counted - expected`),
    check("cash_sessions_counted", sql`counted >= 0`),
    check("cash_sessions_kept", sql`kept between 0 and counted`),
    check("cash_sessions_close_note_length", sql`char_length(close_note) between 1 and 140`),
    check(
      "cash_sessions_close_note",
      sql`case when status = 'OPEN' then close_note is null else difference = 0 or close_note is not null end`,
    ),
  ],
);

/** Sangria e reforço: só inserção. Tirar é outra linha (`cash_entry_removals`). */
export const cashEntries = pgTable(
  "cash_entries",
  {
    ...base,
    cashSessionId: uuid("cash_session_id")
      .notNull()
      .references(() => cashSessions.id),
    kind: cashEntryKindEnum("kind").notNull(),
    amount: money("amount").notNull(),
    reason: cashWithdrawalReasonEnum("reason"),
    note: text("note"),
    clientRequestId: uuid("client_request_id").notNull(),
  },
  (t) => [
    // Também serve a leitura dos lançamentos do turno: não precisa de outro índice só do turno.
    uniqueIndex("cash_entries_client_request").on(t.cashSessionId, t.clientRequestId),
    check("cash_entries_amount", sql`amount > 0`),
    check("cash_entries_by", sql`created_by is not null`),
    check("cash_entries_reason", sql`(kind = 'WITHDRAWAL') = (reason is not null)`),
    check("cash_entries_note_length", sql`char_length(note) between 1 and 140`),
    check("cash_entries_note", sql`reason is distinct from 'OTHER' or note is not null`),
  ],
);

/** Sangria ou reforço tirado (lançado errado): só inserção, uma vez por lançamento. */
export const cashEntryRemovals = pgTable(
  "cash_entry_removals",
  {
    ...base,
    entryId: uuid("entry_id")
      .notNull()
      .references(() => cashEntries.id),
  },
  (t) => [
    uniqueIndex("cash_entry_removals_entry").on(t.entryId),
    check("cash_entry_removals_by", sql`created_by is not null`),
  ],
);

/** Contagem do dinheiro da gaveta: só inserção; o fechamento usa a última. */
export const cashCounts = pgTable(
  "cash_counts",
  {
    ...base,
    cashSessionId: uuid("cash_session_id")
      .notNull()
      .references(() => cashSessions.id),
    counted: money("counted").notNull(),
    /** `{ "200": 1, …, "0.05": 3 }` quando a calculadora foi usada. */
    denominations: jsonb("denominations").$type<Record<string, number>>(),
    /** `version` do turno quando a contagem foi gravada. */
    sessionVersion: integer("session_version").notNull(),
  },
  (t) => [
    index("cash_counts_session").on(t.cashSessionId, t.createdAt),
    check("cash_counts_counted", sql`counted >= 0`),
    check("cash_counts_by", sql`created_by is not null`),
  ],
);
