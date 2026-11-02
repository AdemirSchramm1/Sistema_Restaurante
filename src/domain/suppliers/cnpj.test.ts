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
});
