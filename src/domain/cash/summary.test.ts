import { describe, it, expect } from "vitest";
import { d } from "../shared/decimal";
import { PAYMENT_METHODS } from "../billing/payment";
import { expectedCash, receivedByMethod, sessionSummary, steps, totalOf } from "./summary";

const figures = (over: Partial<Record<keyof Parameters<typeof expectedCash>[0], string>> = {}) => ({
  openingFloat: d(over.openingFloat ?? "150.00"),
  cashReceived: d(over.cashReceived ?? "77.00"),
  cashRemovedFromOtherSessions: d(over.cashRemovedFromOtherSessions ?? "0"),
  supplies: d(over.supplies ?? "50.00"),
  withdrawals: d(over.withdrawals ?? "150.00"),
});
const money = (v: { toFixed(n: number): string }) => v.toFixed(2);

describe("dinheiro esperado na gaveta (spec 014, FR-004)", () => {
  it("troco + recebido em dinheiro − tirados de outro turno + reforços − sangrias: o exemplo da US5 dá R$ 127,00", () => {
    expect(money(expectedCash(figures()))).toBe("127.00");
  });

  it("sem nenhum lançamento, o esperado é o troco inicial", () => {
    expect(money(expectedCash(figures({ cashReceived: "0", supplies: "0", withdrawals: "0" })))).toBe(
      "150.00",
    );
  });

  it("pagamento em dinheiro tirado de outro turno subtrai", () => {
    expect(money(expectedCash(figures({ cashRemovedFromOtherSessions: "30.00" })))).toBe("97.00");
  });

  it("o resultado pode ser negativo (dinheiro de outro turno tirado com a gaveta vazia)", () => {
    const expected = expectedCash(
      figures({
        openingFloat: "0",
        cashReceived: "0",
        cashRemovedFromOtherSessions: "30.00",
        supplies: "0",
        withdrawals: "0",
      }),
    );
    expect(money(expected)).toBe("-30.00");
  });

  it("não arredonda nem perde centavo: R$ 0,01 somado 3 vezes é R$ 0,03", () => {
    const expected = expectedCash(
      figures({ openingFloat: "0.01", cashReceived: "0.01", supplies: "0.01", withdrawals: "0" }),
    );
    expect(expected.toString()).toBe("0.03");
  });
});

describe("recebido por forma de pagamento (spec 014, US5-1)", () => {
  it("soma os pagamentos do turno por forma e tira os que foram tirados no próprio turno", () => {
    const received = receivedByMethod(
      [
        { method: "CASH", amount: d("100.00") },
        { method: "PIX", amount: d("40.00") },
      ],
      [{ method: "CASH", amount: d("23.00") }],
    );
    expect(received.map((r) => [r.method, money(r.amount)])).toEqual([
      ["CASH", "77.00"],
      ["PIX", "40.00"],
      ["DEBIT_CARD", "0.00"],
      ["CREDIT_CARD", "0.00"],
      ["OTHER", "0.00"],
    ]);
  });

  it("formas sem pagamento vêm com R$ 0,00, na ordem da lista de formas", () => {
    const received = receivedByMethod([], []);
    expect(received.map((r) => r.method)).toEqual([...PAYMENT_METHODS]);
    expect(received.every((r) => r.amount.isZero())).toBe(true);
  });

  it("o total recebido é a soma das formas", () => {
    expect(
      money(
        totalOf([
          { method: "CASH", amount: d("77.00") },
          { method: "PIX", amount: d("40.00") },
        ]),
      ),
    ).toBe("117.00");
    expect(money(totalOf([]))).toBe("0.00");
  });
});

describe("passo a passo do esperado (spec 014, US5-2)", () => {
  it("devolve as 6 linhas na ordem da spec, com o sinal de cada uma", () => {
    expect(steps(figures()).map((s) => [s.sign, s.key, money(s.amount)])).toEqual([
      [null, "OPENING_FLOAT", "150.00"],
      ["+", "CASH_RECEIVED", "77.00"],
      ["-", "CASH_REMOVED", "0.00"],
      ["+", "SUPPLIES", "50.00"],
      ["-", "WITHDRAWALS", "150.00"],
      ["=", "EXPECTED", "127.00"],
    ]);
  });
});

describe("resumo do turno a partir das linhas (spec 014, US5 e SC-004)", () => {
  const rows = {
    openingFloat: d("150.00"),
    paid: [
      { method: "CASH" as const, amount: d("100.00") },
      { method: "PIX" as const, amount: d("40.00") },
    ],
    removedInSession: [{ method: "CASH" as const, amount: d("23.00") }],
    removedFromOtherSessions: [{ method: "PIX" as const, amount: d("30.00") }],
    entries: [
      { kind: "WITHDRAWAL" as const, amount: d("150.00"), removed: false },
      { kind: "WITHDRAWAL" as const, amount: d("999.00"), removed: true },
      { kind: "SUPPLY" as const, amount: d("50.00"), removed: false },
      { kind: "SUPPLY" as const, amount: d("10.00"), removed: true },
    ],
  };

  it("lançamento tirado não conta; o tirado de outro turno em Pix não mexe no dinheiro", () => {
    const s = sessionSummary(rows);
    expect(money(s.figures.supplies)).toBe("50.00");
    expect(money(s.figures.withdrawals)).toBe("150.00");
    expect(money(s.figures.cashReceived)).toBe("77.00");
    expect(money(s.figures.cashRemovedFromOtherSessions)).toBe("0.00");
    expect(money(s.expected)).toBe("127.00");
    expect(money(s.received)).toBe("117.00");
    expect(s.removedFromOtherSessions.map((r) => [r.method, money(r.amount)])).toEqual([["PIX", "30.00"]]);
  });

  it("dinheiro tirado de outro turno sai do esperado", () => {
    const s = sessionSummary({
      ...rows,
      removedFromOtherSessions: [
        { method: "CASH", amount: d("30.00") },
        { method: "CASH", amount: d("5.00") },
      ],
    });
    expect(money(s.figures.cashRemovedFromOtherSessions)).toBe("35.00");
    expect(money(s.expected)).toBe("92.00");
    expect(s.removedFromOtherSessions.map((r) => [r.method, money(r.amount)])).toEqual([["CASH", "35.00"]]);
  });
});
