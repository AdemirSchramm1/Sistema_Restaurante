import { describe, it, expect } from "vitest";
import { canChangeStockUnit, stockUnitEquivalence, validateItem } from "./item";
import { d } from "../shared/decimal";
import { itemData } from "../../../tests/builders/item-data";

const code = (r: ReturnType<typeof validateItem>) => (r.ok ? "OK" : r.error.code);

describe("as três unidades do item (docs/produto/estoque/02-cadastro-de-itens.md#as-três-unidades)", () => {
  it("aceita item com estoque em kg, receita em g e compra em caixa de 20 kg", () => {
    expect(code(validateItem(itemData()))).toBe("OK");
  });

  it("mostra a equivalência: 1 caixa = 20 kg = 20.000 g", () => {
    const r = stockUnitEquivalence(itemData(), d("1"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.stock.toString()).toBe("20");
      expect(r.value.recipe.toString()).toBe("20000");
    }
  });

  it("caixa com 12: 20 caixas = 240 un", () => {
    const r = stockUnitEquivalence(
      itemData({ stockUnit: "un", recipeUnit: "un", purchaseFactor: d("12") }),
      d("20"),
    );
    expect(r.ok && r.value.stock.toString()).toBe("240");
  });

  it("NF-e: 2 caixas = 24 un", () => {
    const r = stockUnitEquivalence(
      itemData({ stockUnit: "un", recipeUnit: "un", purchaseFactor: d("12") }),
      d("2"),
    );
    expect(r.ok && r.value.stock.toString()).toBe("24");
  });

  it("fração: 0,5 caixa de 240 limões = 120 un", () => {
    const r = stockUnitEquivalence(
      itemData({ stockUnit: "un", recipeUnit: "un", purchaseFactor: d("240") }),
      d("0.5"),
    );
    expect(r.ok && r.value.stock.toString()).toBe("120");
  });

  it("recusa fator de compra zero ou negativo", () => {
    expect(code(validateItem(itemData({ purchaseFactor: d("0") })))).toBe("INVALID_FACTOR");
    expect(code(validateItem(itemData({ purchaseFactor: d("-1") })))).toBe("INVALID_FACTOR");
  });

  it("exige a conversão do item quando estoque em un e receita em g (ovo)", () => {
    const ovo = itemData({
      description: "Ovo branco",
      stockUnit: "un",
      recipeUnit: "g",
      purchaseFactor: d("30"),
    });
    const r = validateItem(ovo);
    expect(code(r)).toBe("MISSING_ITEM_CONVERSION");
    if (!r.ok) expect(r.error.field).toBe("conversions");
  });

  it("aceita o ovo com 1 un = 50 g e converte para receita", () => {
    const ovo = itemData({
      stockUnit: "un",
      recipeUnit: "g",
      purchaseFactor: d("30"),
      conversions: [{ fromUnit: "un", toUnit: "g", factor: d("50") }],
    });
    expect(code(validateItem(ovo))).toBe("OK");
    const r = stockUnitEquivalence(ovo, d("1"));
    expect(r.ok && r.value.recipe.toString()).toBe("1500");
  });

  it("recusa conversão do item com fator zero ou entre a mesma dimensão", () => {
    expect(
      code(
        validateItem(
          itemData({
            stockUnit: "un",
            recipeUnit: "g",
            conversions: [{ fromUnit: "un", toUnit: "g", factor: d("0") }],
          }),
        ),
      ),
    ).toBe("INVALID_FACTOR");
    expect(
      code(validateItem(itemData({ conversions: [{ fromUnit: "kg", toUnit: "g", factor: d("1000") }] }))),
    ).toBe("VALIDATION");
  });

  it("exige descrição entre 3 e 200 caracteres", () => {
    expect(code(validateItem(itemData({ description: "ab" })))).toBe("INVALID_DESCRIPTION");
    expect(code(validateItem(itemData({ description: "x".repeat(201) })))).toBe("INVALID_DESCRIPTION");
    expect(code(validateItem(itemData({ description: "   abc   " })))).toBe("OK");
  });

  it("exige o nome da embalagem de compra", () => {
    const r = validateItem(itemData({ purchaseUnitLabel: "  " }));
    expect(code(r)).toBe("VALIDATION");
    if (!r.ok) expect(r.error.field).toBe("purchaseUnitLabel");
  });
});

describe("unidade de estoque bloqueada após a 1ª movimentação (FR-023)", () => {
  it("bloqueia a troca quando o item já movimentou", () => {
    const r = canChangeStockUnit(
      { stockUnit: "kg", stockUnitLockedAt: new Date("2026-10-01T00:00:00Z") },
      "un",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("ITEM_UNIT_LOCKED");
  });

  it("permite a troca antes da 1ª movimentação", () => {
    expect(canChangeStockUnit({ stockUnit: "kg", stockUnitLockedAt: null }, "un").ok).toBe(true);
  });

  it("manter a mesma unidade nunca é bloqueado", () => {
    expect(
      canChangeStockUnit({ stockUnit: "kg", stockUnitLockedAt: new Date("2026-10-01T00:00:00Z") }, "kg").ok,
    ).toBe(true);
  });
});

describe("entra no CMV: vem do grupo e pode ser sobrescrito no item (docs/produto/estoque/01-grupos-de-itens.md#critérios-de-aceite-para-a-spec)", () => {
  it("sem sobrescrita, segue o grupo", async () => {
    const { effectiveInCogs } = await import("./item");
    expect(effectiveInCogs({ groupInCogs: true, inCogsOverride: null })).toBe(true);
    expect(effectiveInCogs({ groupInCogs: false, inCogsOverride: null })).toBe(false);
  });

  it("a sobrescrita do item vale sobre o grupo", async () => {
    const { effectiveInCogs } = await import("./item");
    expect(effectiveInCogs({ groupInCogs: false, inCogsOverride: true })).toBe(true);
    expect(effectiveInCogs({ groupInCogs: true, inCogsOverride: false })).toBe(false);
  });
});
