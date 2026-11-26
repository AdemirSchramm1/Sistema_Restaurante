import { describe, it, expect } from "vitest";
import { checkPayment, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "./payment";
import { d } from "../shared/decimal";

const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);
const pay = (method: PaymentMethod, amount: string, received: string | null = null) => ({
  method,
  amount: d(amount),
  received: received === null ? null : d(received),
});
const view = (r: ReturnType<typeof checkPayment>) =>
  r.ok
    ? {
        method: r.value.method,
        amount: r.value.amount.toFixed(2),
        received: r.value.received?.toFixed(2) ?? null,
        change: r.value.change?.toFixed(2) ?? null,
      }
    : r.error.code;

describe("pagamento da conta (spec 011, US2 e FR-003)", () => {
  it("cinco formas, em português", () => {
    expect(PAYMENT_METHODS.map((m) => PAYMENT_METHOD_LABELS[m])).toEqual([
      "Dinheiro",
      "Pix",
      "Cartão de débito",
      "Cartão de crédito",
      "Outro",
    ]);
  });

  it("Pix de R$ 77,00 numa conta de R$ 77,00", () => {
    expect(view(checkPayment(pay("PIX", "77.00"), d("77.00")))).toEqual({
      method: "PIX",
      amount: "77.00",
      received: null,
      change: null,
    });
  });

  it("valor maior que zero, com até 2 casas", () => {
    for (const bad of ["0", "-1", "1.005"])
      expect(code(checkPayment(pay("PIX", bad), d("77.00"))), bad).toBe("INVALID_AMOUNT");
  });

  it("o valor não passa do que falta: PAYMENT_EXCEEDS_REMAINING com quanto falta", () => {
    const r = checkPayment(pay("CREDIT_CARD", "40.01"), d("40.00"));
    expect(code(r)).toBe("PAYMENT_EXCEEDS_REMAINING");
    if (!r.ok) expect(r.error.details).toEqual({ remaining: "40.00" });
    expect(code(checkPayment(pay("CASH", "30.00", "50.00"), d("24.93")))).toBe("PAYMENT_EXCEEDS_REMAINING");
    expect(code(checkPayment(pay("PIX", "1.00"), d("0")))).toBe("PAYMENT_EXCEEDS_REMAINING");
  });

  it("em dinheiro, troco = recebido − valor: falta R$ 24,93, recebe R$ 50,00, troco R$ 25,07", () => {
    expect(view(checkPayment(pay("CASH", "24.93", "50.00"), d("24.93")))).toEqual({
      method: "CASH",
      amount: "24.93",
      received: "50.00",
      change: "25.07",
    });
  });

  it("em dinheiro sem dizer o recebido: recebido = valor e troco zero", () => {
    expect(view(checkPayment(pay("CASH", "10.00"), d("24.93")))).toEqual({
      method: "CASH",
      amount: "10.00",
      received: "10.00",
      change: "0.00",
    });
  });

  it("recebido menor que o valor: RECEIVED_TOO_LOW", () => {
    expect(code(checkPayment(pay("CASH", "24.93", "20.00"), d("24.93")))).toBe("RECEIVED_TOO_LOW");
    expect(code(checkPayment(pay("CASH", "24.93", "50.005"), d("24.93")))).toBe("INVALID_AMOUNT");
  });

  it("recebido só existe no dinheiro", () => {
    const r = checkPayment(pay("PIX", "10.00", "20.00"), d("77.00"));
    expect(code(r)).toBe("VALIDATION");
    if (!r.ok) expect(r.error.field).toBe("received");
  });

  it("cada recusa diz o campo da tela onde aparece o aviso (spec 018, R4)", () => {
    const fail = (r: ReturnType<typeof checkPayment>) => (r.ok ? "OK" : `${r.error.code} ${r.error.field}`);
    expect(fail(checkPayment(pay("CHEQUE" as PaymentMethod, "10.00"), d("77.00")))).toBe("VALIDATION method");
    expect(fail(checkPayment(pay("PIX", "0.00"), d("77.00")))).toBe("INVALID_AMOUNT amount");
    expect(fail(checkPayment(pay("PIX", "10.00", "20.00"), d("77.00")))).toBe("VALIDATION received");
    expect(fail(checkPayment(pay("PIX", "80.00"), d("77.00")))).toBe("PAYMENT_EXCEEDS_REMAINING amount");
    expect(fail(checkPayment(pay("CASH", "10.00", "0.00"), d("77.00")))).toBe("INVALID_AMOUNT received");
    expect(fail(checkPayment(pay("CASH", "10.00", "5.00"), d("77.00")))).toBe("RECEIVED_TOO_LOW received");
  });

  it("forma fora da lista é recusada", () => {
    expect(code(checkPayment(pay("CHEQUE" as PaymentMethod, "10.00"), d("77.00")))).toBe("VALIDATION");
  });
});
