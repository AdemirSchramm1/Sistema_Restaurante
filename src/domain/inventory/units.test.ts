import { describe, it, expect } from "vitest";
import { convert, toStockUnit, fromStockUnit, unitByCode } from "./units";
import { d } from "../shared/decimal";

const u = (c: string) => unitByCode(c)!;

describe("conversão de unidades (docs/produto/estoque/02-cadastro-de-itens.md#as-três-unidades)", () => {
  it("converte massa: 1,5 kg → 1500 g", () => {
    const r = convert(d("1.5"), u("kg"), u("g"));
    expect(r.ok && r.value.toString()).toBe("1500");
  });

  it("converte volume: 1000 ml → 1 l", () => {
    const r = convert(d("1000"), u("ml"), u("l"));
    expect(r.ok && r.value.toString()).toBe("1");
  });

  it("recusa kg → un sem conversão do item", () => {
    const r = convert(d("1"), u("kg"), u("un"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UNIT_DIMENSION_MISMATCH");
  });

  it("usa a conversão do item: 1 un de ovo = 50 g, então 3 un = 150 g", () => {
    const conv = [{ fromUnit: u("un"), toUnit: u("g"), factor: d("50") }];
    const r = convert(d("3"), u("un"), u("g"), conv);
    expect(r.ok && r.value.toString()).toBe("150");
  });

  it("calcula o inverso da conversão do item: 100 g de ovo = 2 un", () => {
    const conv = [{ fromUnit: u("un"), toUnit: u("g"), factor: d("50") }];
    const r = convert(d("100"), u("g"), u("un"), conv);
    expect(r.ok && r.value.toString()).toBe("2");
  });

  it("combina conversão do item com unidades da mesma dimensão: 1 un = 50 g → 20 un = 1 kg", () => {
    const conv = [{ fromUnit: u("un"), toUnit: u("g"), factor: d("50") }];
    const r = convert(d("20"), u("un"), u("kg"), conv);
    expect(r.ok && r.value.toString()).toBe("1");
  });

  it("caixa com 12: 20 caixas = 240 un", () => {
    const r = toStockUnit(d("20"), d("12"));
    expect(r.ok && r.value.toString()).toBe("240");
  });

  it("NF-e: 2 caixas × 12 = 24 un", () => {
    const r = toStockUnit(d("2"), d("12"));
    expect(r.ok && r.value.toString()).toBe("24");
  });

  it("fração na contagem: 120 limões de caixa de 240 = 0,5 caixa", () => {
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
