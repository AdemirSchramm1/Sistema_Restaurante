import { describe, it, expect } from "vitest";
import { formatItemCode, nextTwoDigitCode } from "./item-code";

describe("código do item GG.SS.NNNN (docs/produto/estoque/02-cadastro-de-itens.md#descrição-padronizada-e-código)", () => {
  it("monta o código do primeiro item do subgrupo 01.02", () => {
    const r = formatItemCode("01", "02", 1);
    expect(r.ok && r.value).toBe("01.02.0001");
  });

  it("aceita até 9999 no subgrupo", () => {
    const r = formatItemCode("01", "02", 9999);
    expect(r.ok && r.value).toBe("01.02.9999");
  });

  it("recusa o 10.000º item do subgrupo", () => {
    const r = formatItemCode("01", "02", 10000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SUBGROUP_SEQUENCE_EXHAUSTED");
  });
});

describe("códigos de 2 dígitos de grupos e subgrupos (FR-009)", () => {
  it("formata o contador com dois dígitos", () => {
    const r = nextTwoDigitCode(14);
    expect(r.ok && r.value).toBe("14");
    const s = nextTwoDigitCode(5);
    expect(s.ok && s.value).toBe("05");
  });

  it("recusa quando passa de 99", () => {
    const r = nextTwoDigitCode(100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("GROUP_CODES_EXHAUSTED");
  });
});

describe("limites dos contadores (spec 018)", () => {
  const fail = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

  it("sequência do item começa em 1 e é inteira", () => {
    expect(fail(formatItemCode("01", "02", 0))).toBe("SUBGROUP_SEQUENCE_EXHAUSTED");
    expect(fail(formatItemCode("01", "02", 1.5))).toBe("SUBGROUP_SEQUENCE_EXHAUSTED");
  });

  it("contador de grupo vai de 1 a 99, inteiro", () => {
    const value = (n: number) => {
      const r = nextTwoDigitCode(n);
      return r.ok ? r.value : r.error.code;
    };
    expect([0, 1, 99, 2.5].map(value)).toEqual([
      "GROUP_CODES_EXHAUSTED",
      "01",
      "99",
      "GROUP_CODES_EXHAUSTED",
    ]);
  });
});
