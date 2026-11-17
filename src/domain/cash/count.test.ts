import { describe, it, expect } from "vitest";
import { d } from "../shared/decimal";
import { DENOMINATIONS, DENOMINATION_LABELS, checkCount, sumDenominations } from "./count";

const code = (r: { ok: boolean; error?: { code: string; field?: string } }) =>
  r.ok ? "OK" : `${r.error!.code}${r.error!.field ? `:${r.error!.field}` : ""}`;
const count = (counted: string, denominations: Record<string, unknown> | null = null) =>
  checkCount({ counted: d(counted), denominations });

describe("contagem da gaveta (spec 014, US4-1 e FR-005)", () => {
  it("cédulas e moedas do real, da maior para a menor", () => {
    expect([...DENOMINATIONS]).toEqual([
      "200",
      "100",
      "50",
      "20",
      "10",
      "5",
      "2",
      "1",
      "0.50",
      "0.25",
      "0.10",
      "0.05",
    ]);
    expect(DENOMINATIONS.map((v) => DENOMINATION_LABELS[v])).toEqual([
      "R$ 200",
      "R$ 100",
      "R$ 50",
      "R$ 20",
      "R$ 10",
      "R$ 5",
      "R$ 2",
      "R$ 1",
      "R$ 0,50",
      "R$ 0,25",
      "R$ 0,10",
      "R$ 0,05",
    ]);
  });

  it("aceita R$ 0,00 e R$ 125,00 digitados direto", () => {
    expect(code(count("0"))).toBe("OK");
    const r = count("125.00");
    expect(r.ok && [r.value.counted.toFixed(2), r.value.denominations]).toEqual(["125.00", null]);
  });

  it("recusa contado negativo ou com 3 casas", () => {
    expect(code(count("-1"))).toBe("INVALID_AMOUNT:counted");
    expect(code(count("1.005"))).toBe("INVALID_AMOUNT:counted");
  });

  it("com a calculadora, a soma das cédulas tem que ser o contado", () => {
    const r = count("125.00", { "100": 1, "20": 1, "5": 1, "2": 0 });
    expect(r.ok && r.value.denominations).toEqual({ "100": 1, "20": 1, "5": 1 });
    expect(code(count("126.00", { "100": 1, "20": 1, "5": 1 }))).toBe("DENOMINATIONS_MISMATCH:denominations");
  });

  it("calculadora vazia vale como total digitado", () => {
    const r = count("10.00", {});
    expect(r.ok && r.value.denominations).toBeNull();
    const zeros = count("10.00", { "10": 0 });
    expect(zeros.ok && zeros.value.denominations).toBeNull();
  });

  it("cédula fora da lista, quantidade negativa, fracionária ou que não é número é recusada", () => {
    expect(code(count("3.00", { "3": 1 }))).toBe("DENOMINATIONS_MISMATCH:denominations");
    expect(code(count("0", { "10": -1, "5": 2 }))).toBe("DENOMINATIONS_MISMATCH:denominations");
    expect(code(count("5.00", { "10": 0.5 }))).toBe("DENOMINATIONS_MISMATCH:denominations");
    expect(code(count("10.00", { "10": "1" }))).toBe("DENOMINATIONS_MISMATCH:denominations");
  });

  it("soma sem erro de ponto flutuante: 3 moedas de R$ 0,10 são R$ 0,30", () => {
    expect(sumDenominations({ "0.10": 3 }).toString()).toBe("0.3");
    expect(sumDenominations({ "0.05": 1, "0.25": 1, "200": 2 }).toFixed(2)).toBe("400.30");
    expect(sumDenominations({}).toFixed(2)).toBe("0.00");
  });
});
