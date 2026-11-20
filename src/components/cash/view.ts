import type { CashClosingState } from "@/application/cash/closing";
import type { CashEntryRecord, CashSessionStatus } from "@/application/cash/ports";
import type { CashSessionReport, CashSessionRow } from "@/application/cash/reports";
import type { CashStatus } from "@/application/cash/sessions";
import type { PaymentMethod } from "@/domain/billing/payment";
import type { EntryKind, WithdrawalReason } from "@/domain/cash/entries";
import { outcomeOf, type ClosingOutcome } from "@/domain/cash/session";
import type { MethodAmount, StepKey } from "@/domain/cash/summary";
import type { Decimal } from "@/domain/shared/decimal";
import type { CloseResultView } from "./close-result";

/** O caixa do dia como a tela recebe (spec 014): dinheiro em texto com 2 casas, datas em ISO. */

const money = (v: Decimal) => v.toFixed(2);
const moneyOrNull = (v: Decimal | null) => v?.toFixed(2) ?? null;
const iso = (v: Date | null) => v?.toISOString() ?? null;

export type MethodAmountView = { method: PaymentMethod; amount: string };
const methods = (rows: readonly MethodAmount[]): MethodAmountView[] =>
  rows.map((r) => ({ method: r.method, amount: money(r.amount) }));

export type EntryView = {
  id: string;
  kind: EntryKind;
  amount: string;
  reason: WithdrawalReason | null;
  note: string | null;
  at: string;
  byName: string | null;
  removedAt: string | null;
  removedByName: string | null;
};

export const entryView = (e: CashEntryRecord): EntryView => ({
  id: e.id,
  kind: e.kind,
  amount: money(e.amount),
  reason: e.reason,
  note: e.note,
  at: e.at.toISOString(),
  byName: e.byName,
  removedAt: iso(e.removedAt),
  removedByName: e.removedByName,
});

export type CashBarView = {
  session: {
    id: string;
    openedAt: string;
    openedByName: string | null;
    ageHours: number;
    /** Só chega para quem pode ver o esperado do turno aberto. */
    expected: string | null;
  } | null;
  previousKept: string | null;
  timezone: string;
  canOperate: boolean;
  canClose: boolean;
  serverNow: string;
};

export const cashBarView = (s: CashStatus): CashBarView => ({
  session: s.session && {
    id: s.session.id,
    openedAt: s.session.openedAt.toISOString(),
    openedByName: s.session.openedByName,
    ageHours: s.session.ageHours,
    expected: moneyOrNull(s.session.expected),
  },
  previousKept: moneyOrNull(s.previousKept),
  timezone: s.timezone,
  canOperate: s.canOperate,
  canClose: s.canClose,
  serverNow: s.serverNow,
});

/** Resultado da última contagem; nada se não há contagem ou se ela perdeu a validade. */
export function closeResultView(c: CashClosingState): CloseResultView | null {
  const last = c.lastCount;
  if (!last?.expected) return null;
  const difference = last.counted.minus(last.expected);
  return {
    sessionId: c.sessionId,
    counted: money(last.counted),
    expected: money(last.expected),
    difference: money(difference),
    result: outcomeOf(difference),
    counts: c.counts.map(money),
    openTabs: c.openTabs,
  };
}

export type SessionReportView = {
  id: string;
  status: CashSessionStatus;
  businessDay: string;
  restaurantName: string;
  timezone: string;
  openedAt: string;
  openedByName: string | null;
  openingFloat: string;
  previousKept: string | null;
  openingNote: string | null;
  closedAt: string | null;
  closedByName: string | null;
  receivedByMethod: MethodAmountView[];
  received: string;
  removedFromOtherSessions: MethodAmountView[];
  serviceCharge: string;
  entries: EntryView[];
  /** Contagens em ordem. */
  counts: string[];
  steps: { key: StepKey; sign: "+" | "-" | "=" | null; amount: string }[] | null;
  expected: string | null;
  counted: string | null;
  difference: string | null;
  result: ClosingOutcome | null;
  kept: string | null;
  takenToSafe: string | null;
  closeNote: string | null;
};

export const sessionReportView = (r: CashSessionReport): SessionReportView => ({
  id: r.id,
  status: r.status,
  businessDay: r.businessDay,
  restaurantName: r.restaurantName,
  timezone: r.timezone,
  openedAt: r.openedAt.toISOString(),
  openedByName: r.openedByName,
  openingFloat: money(r.openingFloat),
  previousKept: moneyOrNull(r.previousKept),
  openingNote: r.openingNote,
  closedAt: iso(r.closedAt),
  closedByName: r.closedByName,
  receivedByMethod: methods(r.receivedByMethod),
  received: money(r.received),
  removedFromOtherSessions: methods(r.removedFromOtherSessions),
  serviceCharge: money(r.serviceCharge),
  entries: r.entries.map(entryView),
  counts: r.counts.map((c) => money(c.counted)),
  steps: r.steps && r.steps.map((s) => ({ ...s, amount: money(s.amount) })),
  expected: moneyOrNull(r.expected),
  counted: moneyOrNull(r.counted),
  difference: moneyOrNull(r.difference),
  result: r.result,
  kept: moneyOrNull(r.kept),
  takenToSafe: moneyOrNull(r.takenToSafe),
  closeNote: r.closeNote,
});

export type SessionRowView = {
  id: string;
  businessDay: string;
  status: CashSessionStatus;
  openedAt: string;
  openedByName: string | null;
  closedAt: string | null;
  closedByName: string | null;
  received: string;
  difference: string | null;
  result: ClosingOutcome | null;
};

export const sessionRowView = (s: CashSessionRow): SessionRowView => ({
  id: s.id,
  businessDay: s.businessDay,
  status: s.status,
  openedAt: s.openedAt.toISOString(),
  openedByName: s.openedByName,
  closedAt: iso(s.closedAt),
  closedByName: s.closedByName,
  received: money(s.received),
  difference: moneyOrNull(s.difference),
  result: s.result,
});
