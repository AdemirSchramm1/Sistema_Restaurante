import { describe, it, expect } from "vitest";
import { convert, toStockUnit, fromStockUnit, unitByCode } from "./units";
import { d } from "../shared/decimal";

const u = (c: string) => unitByCode(c)!;

describe("conversão de unidades (docs/produto/estoque/02-cadastro-de-itens.md#2-em-que-medida-você-controla)", () => {
  it("converte massa: 1,5 kg → 1500 g", () => {
    const r = convert(d("1.5"), u("kg"), u("g"));
    expect(r.ok && r.value.toString()).toBe("1500");
  });

  it("converte volume: 1000 ml → 1 l", () => {
    const r = convert(d("1000"), u("ml"), u("l"));
    expect(r.ok && r.value.toString()).toBe("1");
  });

  it("recusa kg → un (famílias diferentes)", () => {
    const r = convert(d("1"), u("kg"), u("un"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UNIT_DIMENSION_MISMATCH");
  });

  it("caixa com 12: 20 caixas = 240 un", () => {
    const r = toStockUnit(d("20"), d("12"));
    expect(r.ok && r.value.toString()).toBe("240");
  });

  it("NF-e: 2 caixas × 12 = 24 un", () => {
    const r = toStockUnit(d("2"), d("12"));
    expect(r.ok && r.value.toString()).toBe("24");
  });

  it("fração: 120 limões de caixa de 240 = 0,5 caixa", () => {
    const r = fromStockUnit(d("120"), d("240"));
    expect(r.ok && r.value.toString()).toBe("0.5");
  });

  it("recusa fator zero ou negativo", () => {
    for (const f of ["0", "-1"]) {
      const r = toStockUnit(d("1"), d(f));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("INVALID_FACTOR");
      expect(fromStockUnit(d("1"), d(f)).ok).toBe(false);
    }
  });

  it("conhece só as unidades do catálogo", () => {
    expect(unitByCode("caixa")).toBeUndefined();
  });
});
