import { describe, it, expect } from "vitest";
import { d } from "../shared/decimal";
import { checkOpening, closingResult, outcomeOf } from "./session";

const code = (r: { ok: boolean; error?: { code: string; field?: string } }) =>
  r.ok ? "OK" : `${r.error!.code}${r.error!.field ? `:${r.error!.field}` : ""}`;
const open = (openingFloat: string, previousKept: string | null = null, note: string | null = null) =>
  checkOpening({
    openingFloat: d(openingFloat),
    previousKept: previousKept === null ? null : d(previousKept),
    note,
  });

describe("abrir o caixa (spec 014, FR-001)", () => {
  it("aceita R$ 0,00 e R$ 150,00 de troco", () => {
    expect(code(open("0"))).toBe("OK");
    const r = open("150.00");
    expect(r.ok && [r.value.openingFloat.toFixed(2), r.value.note]).toEqual(["150.00", null]);
  });

  it("recusa troco negativo ou com 3 casas", () => {
    expect(code(open("-1"))).toBe("INVALID_AMOUNT:openingFloat");
    expect(code(open("1.005"))).toBe("INVALID_AMOUNT:openingFloat");
  });

  it("troco igual ao que ficou na gaveta não pede observação", () => {
    expect(code(open("150.00", "150.00"))).toBe("OK");
  });

  it("troco diferente do que ficou na gaveta pede observação e diz quanto ficou", () => {
    const r = open("120.00", "150.00");
    expect(code(r)).toBe("OPENING_NOTE_REQUIRED:note");
    expect(!r.ok && r.error.details).toEqual({ previousKept: "150.00" });
    expect(code(open("120.00", "150.00", "   "))).toBe("OPENING_NOTE_REQUIRED:note");
    const withNote = open("120.00", "150.00", "  Gerente levou R$ 30,00 ao cofre ");
    expect(withNote.ok && withNote.value.note).toBe("Gerente levou R$ 30,00 ao cofre");
  });

  it("observação com mais de 140 letras é recusada; com 140 passa", () => {
    expect(code(open("150.00", null, "a".repeat(141)))).toBe("NOTE_TOO_LONG:note");
    expect(code(open("150.00", null, "a".repeat(140)))).toBe("OK");
  });

  it("no primeiro turno (sem fechamento anterior) nunca pede observação", () => {
    expect(code(open("37.50", null))).toBe("OK");
  });
});

const close = (expected: string, counted: string, kept: string | null = null, note: string | null = null) =>
  closingResult({ expected: d(expected), counted: d(counted), kept: kept === null ? null : d(kept), note });

describe("fechar o caixa (spec 014, FR-005)", () => {
  it("contado igual ao esperado: bateu, sem observação", () => {
    const r = close("127.00", "127.00");
    expect(r.ok && [r.value.result, r.value.difference.toFixed(2), r.value.note]).toEqual([
      "BALANCED",
      "0.00",
      null,
    ]);
  });

  it("contado R$ 125,00 com esperado R$ 127,00: falta R$ 2,00 e a observação é obrigatória", () => {
    const missing = close("127.00", "125.00");
    expect(code(missing)).toBe("NOTE_REQUIRED:note");
    expect(!missing.ok && missing.error.details).toEqual({ reason: "difference" });
    const r = close("127.00", "125.00", null, " Troco errado na mesa 4 ");
    expect(r.ok && [r.value.result, r.value.difference.toFixed(2), r.value.note]).toEqual([
      "SHORT",
      "-2.00",
      "Troco errado na mesa 4",
    ]);
  });

  it("contado R$ 130,00: sobra R$ 3,00", () => {
    const r = close("127.00", "130.00", null, "Sobrou");
    expect(r.ok && [r.value.result, r.value.difference.toFixed(2)]).toEqual(["OVER", "3.00"]);
  });

  it("o que fica na gaveta não passa do contado; sem informar, fica tudo", () => {
    expect(code(close("127.00", "127.00", "127.01"))).toBe("KEPT_ABOVE_COUNTED:kept");
    const all = close("127.00", "127.00");
    expect(all.ok && [all.value.kept.toFixed(2), all.value.takenToSafe.toFixed(2)]).toEqual([
      "127.00",
      "0.00",
    ]);
  });

  it("retirada do fechamento = contado − fica na gaveta", () => {
    const r = close("127.00", "127.00", "100.00");
    expect(r.ok && [r.value.kept.toFixed(2), r.value.takenToSafe.toFixed(2)]).toEqual(["100.00", "27.00"]);
    const none = close("127.00", "127.00", "0");
    expect(none.ok && none.value.takenToSafe.toFixed(2)).toBe("127.00");
  });

  it("fica na gaveta negativo ou com 3 casas é recusado", () => {
    expect(code(close("127.00", "127.00", "-1"))).toBe("INVALID_AMOUNT:kept");
    expect(code(close("127.00", "127.00", "1.001"))).toBe("INVALID_AMOUNT:kept");
  });

  it("observação com mais de 140 letras é recusada", () => {
    expect(code(close("127.00", "125.00", null, "a".repeat(141)))).toBe("NOTE_TOO_LONG:note");
  });

  it("esperado negativo funciona igual: contado R$ 0,00 sobra R$ 30,00", () => {
    const r = close("-30.00", "0", null, "Pix devolvido em dinheiro");
    expect(r.ok && [r.value.result, r.value.difference.toFixed(2)]).toEqual(["OVER", "30.00"]);
  });

  it("resultado pela diferença: zero bate, positiva sobra, negativa falta", () => {
    expect([outcomeOf(d("0")), outcomeOf(d("0.01")), outcomeOf(d("-0.01"))]).toEqual([
      "BALANCED",
      "OVER",
      "SHORT",
    ]);
  });
});
