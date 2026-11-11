import { describe, it, expect } from "vitest";
import { splitEvenly } from "./split";
import { d, Decimal } from "../shared/decimal";

const parts = (remaining: string, people: number) => {
  const r = splitEvenly(d(remaining), people);
  return r.ok ? r.value.map((p) => p.toFixed(2)) : r.error.code;
};

describe("dividir a conta em partes iguais (spec 011, US3 e FR-005)", () => {
  it("R$ 100,00 por 3: os centavos que sobram vão para a primeira parte", () => {
    expect(parts("100.00", 3)).toEqual(["33.34", "33.33", "33.33"]);
  });

  it("R$ 74,80 por 3 (conta da mesa 12 com serviço): 24,94 + 24,93 + 24,93", () => {
    expect(parts("74.80", 3)).toEqual(["24.94", "24.93", "24.93"]);
  });

  it("divisão exata: R$ 77,00 por 2", () => {
    expect(parts("77.00", 2)).toEqual(["38.50", "38.50"]);
  });

  it("um centavo por 2: 0,01 + 0,00", () => {
    expect(parts("0.01", 2)).toEqual(["0.01", "0.00"]);
  });

  it("de 2 a 20 pessoas, número inteiro", () => {
    for (const n of [1, 21, 0, -3, 2.5]) expect(parts("100.00", n), String(n)).toBe("INVALID_PEOPLE");
    expect(parts("100.00", 20)).toHaveLength(20);
  });

  it("a soma das partes é sempre igual ao que falta", () => {
    // Gerador fixo: o teste é sempre o mesmo.
    let seed = 11;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    for (let i = 0; i < 500; i++) {
      const cents = next() % 1_000_000;
      const people = 2 + (next() % 19);
      const remaining = new Decimal(cents).dividedBy(100);
      const r = splitEvenly(remaining, people);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const sum = r.value.reduce((a, b) => a.plus(b), d(0));
      expect(sum.toFixed(2), `${remaining.toFixed(2)} ÷ ${people}`).toBe(remaining.toFixed(2));
      expect(r.value.every((p) => p.decimalPlaces() <= 2 && p.gte(0))).toBe(true);
      expect(r.value[0]!.minus(r.value[people - 1]!).lt(d("0.01").times(people))).toBe(true);
    }
  });
});
