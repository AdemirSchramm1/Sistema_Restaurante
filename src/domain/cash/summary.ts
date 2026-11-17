import { d, type Decimal } from "../shared/decimal";
import { PAYMENT_METHODS, type PaymentMethod } from "../billing/payment";

/** Contas do dinheiro do turno do caixa (spec 014, FR-004 e US5). Tudo em decimal exato. */

export type MethodAmount = { method: PaymentMethod; amount: Decimal };

/** Os cinco números de onde sai o dinheiro esperado na gaveta. */
export type CashFigures = {
  openingFloat: Decimal;
  /** Pagamentos em dinheiro do turno, já sem os tirados no próprio turno. */
  cashReceived: Decimal;
  /** Pagamentos em dinheiro de outro turno (ou de antes da 014) tirados neste turno. */
  cashRemovedFromOtherSessions: Decimal;
  supplies: Decimal;
  withdrawals: Decimal;
};

const sum = (values: readonly Decimal[]) => values.reduce((a, b) => a.plus(b), d(0));
const of = (rows: readonly MethodAmount[], method: PaymentMethod) =>
  sum(rows.filter((r) => r.method === method).map((r) => r.amount));

/** Soma das formas (total recebido). */
export const totalOf = (rows: readonly MethodAmount[]): Decimal => sum(rows.map((r) => r.amount));

/**
 * Esperado = troco inicial + recebido em dinheiro − dinheiro de outro turno tirado neste + reforços
 * − sangrias (FR-004). Sem divisão e sem arredondamento; pode ser negativo.
 */
export function expectedCash(f: CashFigures): Decimal {
  return f.openingFloat
    .plus(f.cashReceived)
    .minus(f.cashRemovedFromOtherSessions)
    .plus(f.supplies)
    .minus(f.withdrawals);
}

/**
 * Recebido por forma: os pagamentos do turno menos os tirados no próprio turno. Um pagamento tirado
 * num turno seguinte continua no turno de origem. Toda forma aparece, na ordem da lista de formas.
 */
export function receivedByMethod(
  paid: readonly MethodAmount[],
  removedInSession: readonly MethodAmount[],
): MethodAmount[] {
  return PAYMENT_METHODS.map((method) => ({
    method,
    amount: of(paid, method).minus(of(removedInSession, method)),
  }));
}

export type StepKey =
  "OPENING_FLOAT" | "CASH_RECEIVED" | "CASH_REMOVED" | "SUPPLIES" | "WITHDRAWALS" | "EXPECTED";
export type Step = { key: StepKey; sign: "+" | "-" | "=" | null; amount: Decimal };

/** A conta do esperado passo a passo, na ordem em que o relatório mostra (US5-2). */
export function steps(f: CashFigures): Step[] {
  return [
    { key: "OPENING_FLOAT", sign: null, amount: f.openingFloat },
    { key: "CASH_RECEIVED", sign: "+", amount: f.cashReceived },
    { key: "CASH_REMOVED", sign: "-", amount: f.cashRemovedFromOtherSessions },
    { key: "SUPPLIES", sign: "+", amount: f.supplies },
    { key: "WITHDRAWALS", sign: "-", amount: f.withdrawals },
    { key: "EXPECTED", sign: "=", amount: expectedCash(f) },
  ];
}

export type SessionRows = {
  openingFloat: Decimal;
  /** Pagamentos lançados no turno, por forma. */
  paid: readonly MethodAmount[];
  /** Pagamentos do turno tirados no próprio turno. */
  removedInSession: readonly MethodAmount[];
  /** Pagamentos de outro turno tirados neste. */
  removedFromOtherSessions: readonly MethodAmount[];
  entries: readonly { kind: "WITHDRAWAL" | "SUPPLY"; amount: Decimal; removed: boolean }[];
};

/** Resumo do turno refeito a partir das linhas: é o que o fechamento grava e o relatório mostra. */
export function sessionSummary(rows: SessionRows) {
  const received = receivedByMethod(rows.paid, rows.removedInSession);
  const active = rows.entries.filter((e) => !e.removed);
  const entrySum = (kind: "WITHDRAWAL" | "SUPPLY") =>
    sum(active.filter((e) => e.kind === kind).map((e) => e.amount));
  const figures: CashFigures = {
    openingFloat: rows.openingFloat,
    cashReceived: of(received, "CASH"),
    cashRemovedFromOtherSessions: of(rows.removedFromOtherSessions, "CASH"),
    supplies: entrySum("SUPPLY"),
    withdrawals: entrySum("WITHDRAWAL"),
  };
  return {
    receivedByMethod: received,
    received: totalOf(received),
    /** Só as formas que tiveram pagamento de outro turno tirado. */
    removedFromOtherSessions: PAYMENT_METHODS.map((method) => ({
      method,
      amount: of(rows.removedFromOtherSessions, method),
    })).filter((r) => !r.amount.isZero()),
    figures,
    expected: expectedCash(figures),
  };
}
