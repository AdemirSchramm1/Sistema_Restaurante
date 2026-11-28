import { describe, it, expect } from "vitest";
import { d, parseBrDecimal, formatBrDecimal, formatBrl } from "./decimal";

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

describe("formatBrl: um jeito só de mostrar reais (spec 012, FR-011)", () => {
  it("mostra R$ com 2 casas, vírgula decimal e ponto de milhar", () => {
    expect(formatBrl(d("1234.5"))).toBe("R$ 1.234,50");
    expect(formatBrl(d("0"))).toBe("R$ 0,00");
    expect(formatBrl(d("34"))).toBe("R$ 34,00");
  });

  it("arredonda meio centavo para cima", () => {
    expect(formatBrl(d("6.805"))).toBe("R$ 6,81");
  });

  it("mostra até 4 casas quando pedido (custo unitário), sem zeros à toa", () => {
    expect(formatBrl(d("8.1234"), { maxPlaces: 4 })).toBe("R$ 8,1234");
    expect(formatBrl(d("8.1"), { maxPlaces: 4 })).toBe("R$ 8,10");
  });

  it("mantém o sinal depois do R$, como as telas já mostravam", () => {
    expect(formatBrl(d("-8.5"))).toBe("R$ -8,50");
  });
});

describe("limites do decimal e do formato brasileiro (spec 018, US3)", () => {
  it("guarda 40 algarismos e arredonda meio para cima", () => {
    expect(d(1).dividedBy(3).toString()).toBe(`0.${"3".repeat(40)}`);
    expect(d(2).dividedBy(3).toString()).toBe(`0.${"6".repeat(39)}7`);
  });

  it("aceita inteiro grande (bigint) e diz como escrever fração", () => {
    expect(d(12345678901234567890123n).toString()).toBe("1.2345678901234567890123e+22");
    expect(() => d(0.5)).toThrow('Use texto para valores fracionários: d("0.5")');
    expect(d(d("1.25")).toString()).toBe("1.25");
  });

  it("lê inteiros, milhar com 1 a 3 algarismos no começo e vários grupos", () => {
    const read = (t: string) => {
      const r = parseBrDecimal(t);
      return r.ok ? r.value.toString() : r.error.code;
    };
    expect(["12", "1234,5", "12.345", "123.456,7", "1.234.567"].map(read)).toEqual([
      "12",
      "1234.5",
      "12345",
      "123456.7",
      "1234567",
    ]);
    expect(read("1234.567")).toBe("INVALID_NUMBER");
  });

  it("sem casas, zero no meio da fração e mínimo maior que o máximo", () => {
    expect(formatBrDecimal(d("12.6"), { maxPlaces: 0 })).toBe("13");
    expect(formatBrDecimal(d("1.05"), { maxPlaces: 2 })).toBe("1,05");
    expect(formatBrDecimal(d("1.5"), { minPlaces: 4, maxPlaces: 2 })).toBe("1,50");
    expect(formatBrDecimal(d("1.5"), { minPlaces: 2, maxPlaces: 4 })).toBe("1,50");
  });

  it("negativo que arredonda para zero perde o sinal; os outros mantêm", () => {
    expect(formatBrDecimal(d("-0.001"), { maxPlaces: 2 })).toBe("0");
    expect(formatBrDecimal(d("-0.001"), { minPlaces: 2, maxPlaces: 2 })).toBe("0,00");
    expect(formatBrDecimal(d("-1.5"), { maxPlaces: 2 })).toBe("-1,5");
    expect(formatBrDecimal(d("-1000"), { maxPlaces: 2 })).toBe("-1.000");
  });
});
