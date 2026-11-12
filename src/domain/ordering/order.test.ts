import { describe, it, expect } from "vitest";
import {
  CANCEL_REASONS,
  ORDER_STATUS_LABELS,
  checkCancel,
  checkTransition,
  isLate,
  isFinal,
  leftTheShelf,
} from "./order";

describe("situações do pedido (spec 009, FR-008)", () => {
  it("anda um passo por vez: Recebido → Em preparo → Pronto → Entregue", () => {
    expect(checkTransition("RECEIVED", "PREPARING").ok).toBe(true);
    expect(checkTransition("PREPARING", "READY").ok).toBe(true);
    expect(checkTransition("READY", "DELIVERED").ok).toBe(true);
  });

  it("não pula etapa nem volta", () => {
    for (const [from, to] of [
      ["RECEIVED", "READY"],
      ["RECEIVED", "DELIVERED"],
      ["READY", "PREPARING"],
      ["PREPARING", "RECEIVED"],
    ] as const) {
      const r = checkTransition(from, to);
      expect(r.ok, `${from}→${to}`).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("INVALID_ORDER_TRANSITION");
    }
  });

  it("entregue e cancelado são finais", () => {
    expect(isFinal("DELIVERED")).toBe(true);
    expect(isFinal("CANCELLED")).toBe(true);
    expect(isFinal("READY")).toBe(false);
    expect(checkTransition("DELIVERED", "READY").ok).toBe(false);
    expect(checkTransition("CANCELLED", "PREPARING").ok).toBe(false);
  });

  it("situações em português", () => {
    expect(ORDER_STATUS_LABELS).toEqual({
      RECEIVED: "Recebido",
      PREPARING: "Em preparo",
      READY: "Pronto",
      DELIVERED: "Entregue",
      CANCELLED: "Cancelado",
    });
  });
});

describe("cancelar pedido (spec 009, US4-6)", () => {
  it("motivos da lista fechada", () => {
    expect(CANCEL_REASONS).toEqual(["CUSTOMER_GAVE_UP", "OUT_OF_PRODUCT", "IMPROPER_ORDER", "OTHER"]);
  });

  it("cancela qualquer pedido ainda não entregue (depois do preparo, dizendo se usou os ingredientes)", () => {
    for (const s of ["RECEIVED", "PREPARING", "READY"] as const)
      expect(checkCancel(s, "CUSTOMER_GAVE_UP", null, s === "RECEIVED" ? null : true)).toEqual({
        ok: true,
        value: { reason: "CUSTOMER_GAVE_UP", note: null },
      });
  });

  it("entregue ou já cancelado não cancela", () => {
    const r = checkCancel("DELIVERED", "OTHER", "x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_ORDER_TRANSITION");
    expect(checkCancel("CANCELLED", "OTHER", "x").ok).toBe(false);
  });

  it('motivo "outro" exige texto de até 140 caracteres', () => {
    const empty = checkCancel("RECEIVED", "OTHER", "  ");
    expect(!empty.ok && empty.error.code).toBe("CANCEL_NOTE_REQUIRED");
    const long = checkCancel("RECEIVED", "OTHER", "a".repeat(141));
    expect(!long.ok && long.error.code).toBe("NOTE_TOO_LONG");
    expect(checkCancel("RECEIVED", "OTHER", " mesa errada ")).toEqual({
      ok: true,
      value: { reason: "OTHER", note: "mesa errada" },
    });
  });

  it("motivo fora da lista é recusado", () => {
    const r = checkCancel("RECEIVED", "NOPE" as never, null);
    expect(!r.ok && r.error.code).toBe("VALIDATION");
  });
});

describe("pedido atrasado (spec 009, US4-7)", () => {
  const sent = new Date("2026-11-08T20:00:00Z");
  const after = (min: number) => new Date(sent.getTime() + min * 60_000);

  it("mais de 20 minutos sem ficar pronto", () => {
    expect(isLate("RECEIVED", sent, after(20))).toBe(false);
    expect(isLate("RECEIVED", sent, after(21))).toBe(true);
    expect(isLate("PREPARING", sent, after(21))).toBe(true);
    expect(isLate("READY", sent, after(60))).toBe(false);
  });
});

describe("cancelar depois do preparo (spec 011, US5)", () => {
  it("em preparo e pronto já baixaram o estoque; recebido não", () => {
    expect(leftTheShelf("RECEIVED")).toBe(false);
    expect(leftTheShelf("PREPARING")).toBe(true);
    expect(leftTheShelf("READY")).toBe(true);
  });

  it("cancelar o que já baixou exige dizer se os ingredientes foram usados", () => {
    const r = checkCancel("PREPARING", "CUSTOMER_GAVE_UP", null, null);
    expect(r.ok ? null : [r.error.code, r.error.field]).toEqual([
      "INGREDIENTS_USED_REQUIRED",
      "ingredientsUsed",
    ]);
    expect(checkCancel("READY", "CUSTOMER_GAVE_UP", null, false).ok).toBe(true);
    expect(checkCancel("RECEIVED", "CUSTOMER_GAVE_UP", null, null).ok).toBe(true);
  });
});
