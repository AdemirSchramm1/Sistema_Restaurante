import type { Result } from "@/domain/shared/result";
import type { Decimal } from "@/domain/shared/decimal";
import type { EntryKind, WithdrawalReason } from "@/domain/cash/entries";
import type { Denominations } from "@/domain/cash/count";
import type { MethodAmount } from "@/domain/cash/summary";
import type { Audit } from "../access/ports";

/** Repositório do caixa do dia (spec 014, data-model.md). */

export type CashSessionStatus = "OPEN" | "CLOSED";

/** Retrato gravado no fechamento do turno. */
export type CashClosing = {
  at: Date;
  by: string;
  byName: string | null;
  expected: Decimal;
  counted: Decimal;
  difference: Decimal;
  kept: Decimal;
  serviceCharge: Decimal;
  countId: string;
  note: string | null;
};

export type CashSessionRecord = {
  id: string;
  status: CashSessionStatus;
  businessDay: string;
  openedAt: Date;
  openedBy: string;
  openedByName: string | null;
  openingFloat: Decimal;
  previousKept: Decimal | null;
  openingNote: string | null;
  clientRequestId: string;
  closing: CashClosing | null;
  version: number;
};

export type CashEntryRecord = {
  id: string;
  sessionId: string;
  kind: EntryKind;
  amount: Decimal;
  reason: WithdrawalReason | null;
  note: string | null;
  at: Date;
  byName: string | null;
  removedAt: Date | null;
  removedByName: string | null;
};

export type CashCountRecord = {
  id: string;
  counted: Decimal;
  denominations: Denominations | null;
  sessionVersion: number;
  at: Date;
  byName: string | null;
};

/** Somas dos pagamentos de um turno, por forma. */
export type SessionPayments = {
  sessionId: string;
  /** Pagamentos lançados no turno. */
  paid: MethodAmount[];
  /** Pagamentos do turno tirados no próprio turno. */
  removedInSession: MethodAmount[];
  /** Pagamentos de outro turno (ou de antes da 014) tirados neste. */
  removedFromOtherSessions: MethodAmount[];
};

export type NewCashSession = {
  id: string;
  businessDay: string;
  openingFloat: Decimal;
  previousKept: Decimal | null;
  note: string | null;
  clientRequestId: string;
};

export type NewCashEntry = {
  id: string;
  sessionId: string;
  kind: EntryKind;
  amount: Decimal;
  reason: WithdrawalReason | null;
  note: string | null;
  clientRequestId: string;
};

export type NewCashCount = {
  id: string;
  sessionId: string;
  counted: Decimal;
  denominations: Denominations | null;
  sessionVersion: number;
};

export type CashClosingSnapshot = {
  expected: Decimal;
  counted: Decimal;
  difference: Decimal;
  kept: Decimal;
  serviceCharge: Decimal;
  countId: string;
  note: string | null;
};

export interface CashSessionRepo {
  /** `CASH_SESSION_ALREADY_OPEN` se o restaurante já tem turno aberto. */
  open(s: NewCashSession, audit: Audit): Promise<Result<void>>;
  /** Turno aberto do restaurante, sem travar. */
  current(): Promise<CashSessionRecord | null>;
  /** Turno aberto travado até o fim da transação; nulo se não há (ou se fechou enquanto esperava). */
  lockOpen(): Promise<CashSessionRecord | null>;
  get(id: string): Promise<CashSessionRecord | null>;
  /** Turno travado até o fim da transação, aberto ou fechado. */
  lock(id: string): Promise<CashSessionRecord | null>;
  /** O turno fechado mais recente (para o troco que ficou na gaveta). */
  lastClosed(): Promise<CashSessionRecord | null>;
  /** +1 na versão: entrou ou saiu dinheiro do turno (pagamento, remoção, sangria, reforço). */
  bumpVersion(id: string, audit: Audit): Promise<void>;
  /** Grava o retrato do fechamento e soma 1 na versão. */
  close(id: string, snapshot: CashClosingSnapshot, audit: Audit): Promise<void>;
  /** Turnos abertos no período (dias do restaurante), o mais recente primeiro. */
  list(fromDay: string, toDay: string): Promise<CashSessionRecord[]>;

  insertEntry(e: NewCashEntry, audit: Audit): Promise<void>;
  /** Lançamentos do turno em ordem, com os tirados. */
  entries(sessionId: string): Promise<CashEntryRecord[]>;
  getEntry(id: string): Promise<CashEntryRecord | null>;
  entryByClientRequest(sessionId: string, clientRequestId: string): Promise<CashEntryRecord | null>;
  /** `ALREADY_REMOVED` se já foi tirado. */
  removeEntry(entryId: string, id: string, audit: Audit): Promise<Result<void>>;
  /** Sangrias e reforços dos turnos dados, para o esperado de vários turnos numa ida ao banco. */
  entryAmounts(
    sessionIds: string[],
  ): Promise<{ sessionId: string; kind: EntryKind; amount: Decimal; removed: boolean }[]>;

  insertCount(c: NewCashCount, audit: Audit): Promise<void>;
  /** Contagens do turno, da primeira para a última. */
  counts(sessionId: string): Promise<CashCountRecord[]>;
  lastCount(sessionId: string): Promise<CashCountRecord | null>;

  /** Recebido, tirado no turno e tirado de outro turno, por forma, dos turnos dados. */
  payments(sessionIds: string[]): Promise<SessionPayments[]>;
  /** Taxa de serviço das contas fechadas no turno (as que estão fechadas agora). */
  serviceCharge(sessionId: string): Promise<Decimal>;
}

export type CashRepos = { cashSessions: CashSessionRepo };
