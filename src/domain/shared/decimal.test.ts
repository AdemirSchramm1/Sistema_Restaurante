import { describe, it, expect } from "vitest";
import { d, parseBrDecimal, formatBrDecimal } from "./decimal";

describe("decimal exato (constituição, princípio IV)", () => {
  it("cria decimais a partir de texto sem perda", () => {
    expect(d("0.1").plus(d("0.2")).toString()).toBe("0.3");
  });

  it("recusa número não inteiro para não esconder erro de ponto flutuante", () => {
    expect(() => d(0.1)).toThrow();
    expect(d(12).toString()).toBe("12");
  });

  it("lê número no formato brasileiro com vírgula decimal", () => {
    const r = parseBrDecimal("1,5");
    expect(r.ok && r.value.toString()).toBe("1.5");
  });

  it("lê separador de milhar", () => {
    const r = parseBrDecimal("1.234,56");
    expect(r.ok && r.value.toString()).toBe("1234.56");
  });

  it("aceita negativo e espaços nas pontas", () => {
    const r = parseBrDecimal("  -8,0 ");
    expect(r.ok && r.value.toString()).toBe("-8");
  });

  it("recusa texto que não é número", () => {
    for (const t of ["abc", "", "1,2,3", "1.2", "1..0", "1,"]) {
      const r = parseBrDecimal(t);
      expect(r.ok, t).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("INVALID_NUMBER");
    }
  });

  it("formata com vírgula e arredonda meio para cima só na exibição", () => {
    expect(formatBrDecimal(d("23.3333333"), { maxPlaces: 2 })).toBe("23,33");
    expect(formatBrDecimal(d("2.345"), { maxPlaces: 2 })).toBe("2,35");
    expect(formatBrDecimal(d("1234567.5"), { maxPlaces: 2 })).toBe("1.234.567,5");
    expect(formatBrDecimal(d("40"), { maxPlaces: 4 })).toBe("40");
    expect(formatBrDecimal(d("10"), { minPlaces: 2, maxPlaces: 2 })).toBe("10,00");
    expect(formatBrDecimal(d("-0.5"), { maxPlaces: 2 })).toBe("-0,5");
  });
});
