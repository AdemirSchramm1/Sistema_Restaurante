import { describe, it, expect } from "vitest";
import { formatCnpj, isValidCnpj, normalizeCnpj, parseCnpj } from "./cnpj";

const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

describe("CNPJ (03-fornecedores, FR-001)", () => {
  it("tira pontuação e espaços e põe em maiúsculas", () => {
    expect(normalizeCnpj(" 11.222.333/0001-81 ")).toBe("11222333000181");
    expect(normalizeCnpj("12.abc.345/01de-35")).toBe("12ABC34501DE35");
  });

  it("aceita CNPJ numérico com dígitos certos", () => {
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("11444777000161")).toBe(true);
  });

  it("recusa dígito verificador errado, tamanho errado e todos iguais", () => {
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
    expect(isValidCnpj("112223330001811")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
  });

  it("aceita o CNPJ alfanumérico (Receita Federal, julho de 2026)", () => {
    expect(isValidCnpj("12ABC34501DE35")).toBe(true);
  });

  it("no alfanumérico, os dois últimos são sempre números", () => {
    expect(isValidCnpj("12ABC34501DE3A")).toBe(false);
    expect(isValidCnpj("12ABC34501DE36")).toBe(false);
    expect(isValidCnpj("12ABC345-1DE35")).toBe(false);
  });

  it("parseCnpj: vazio é sem CNPJ; inválido é INVALID_CNPJ no campo cnpj", () => {
    expect(parseCnpj("  ")).toEqual({ ok: true, value: null });
    expect(parseCnpj("11.222.333/0001-81")).toEqual({ ok: true, value: "11222333000181" });
    const bad = parseCnpj("11.222.333/0001-80");
    expect(code(bad)).toBe("INVALID_CNPJ");
    expect(bad.ok ? null : bad.error.field).toBe("cnpj");
  });

  it("formata com pontos, barra e traço", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });

  it("só aceita exatamente 14 caracteres, mesmo quando os dígitos do fim batem (spec 018)", () => {
    // Os 13 primeiros dão 8 e 1: com um caractere a mais, só o tamanho recusa.
    expect(isValidCnpj("112223330001881")).toBe(false);
    expect(isValidCnpj("X11222333000181")).toBe(false);
  });

  it("acerta os dígitos quando o resto da divisão por 11 é 0, 1 ou 2 (spec 018)", () => {
    // resto 0 e 1 viram dígito 0; resto 2 vira 9.
    for (const c of [
      "00806360837700",
      "72981506162202",
      "01610339621797",
      "06690743915050",
      "11070434192580",
      "99962283038869",
    ]) {
      expect(isValidCnpj(c), c).toBe(true);
    }
    expect(isValidCnpj("00806360837701")).toBe(false);
    expect(isValidCnpj("99962283038868")).toBe(false);
  });

  it("recusa CNPJ de um caractere só repetido, também alfanumérico (spec 018)", () => {
    expect(isValidCnpj("AAAAAAAAAAAA00")).toBe(false);
    expect(isValidCnpj("22222222222222")).toBe(false);
  });

  it("normaliza só espaço, ponto, barra e traço", () => {
    expect(normalizeCnpj("11\t222_333")).toBe("11222_333");
    expect(normalizeCnpj("a.b/c-d e")).toBe("ABCDE");
  });
});
