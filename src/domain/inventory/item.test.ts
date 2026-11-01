import { describe, it, expect } from "vitest";
import { canChangeStockUnit, describePurchase, validateItem } from "./item";
import { d } from "../shared/decimal";
import { itemData } from "../../../tests/builders/item-data";

const code = (r: ReturnType<typeof validateItem>) => (r.ok ? "OK" : r.error.code);
const field = (r: ReturnType<typeof validateItem>) => (r.ok ? undefined : r.error.field);

describe("o que é o item (docs/produto/estoque/02-cadastro-de-itens.md#1-o-que-é)", () => {
  it("aceita o tomate em kg comprado em caixa de 20 kg", () => {
    expect(code(validateItem(itemData()))).toBe("OK");
  });

  it("exige nome entre 3 e 200 caracteres", () => {
    expect(code(validateItem(itemData({ description: "ab" })))).toBe("INVALID_DESCRIPTION");
    expect(code(validateItem(itemData({ description: "x".repeat(201) })))).toBe("INVALID_DESCRIPTION");
    expect(code(validateItem(itemData({ description: "   abc   " })))).toBe("OK");
  });
});

describe("em que medida você controla (docs/produto/estoque/02-cadastro-de-itens.md#2-em-que-medida-você-controla)", () => {
  it("aceita kg, g, l, ml e un", () => {
    for (const u of ["kg", "g", "l", "ml", "un"] as const)
      expect(code(validateItem(itemData({ stockUnit: u }))), u).toBe("OK");
  });

  it("recusa medida fora do catálogo", () => {
    expect(code(validateItem(itemData({ stockUnit: "caixa" as never })))).toBe("UNKNOWN_UNIT");
  });
});

describe("como você compra, opcional (docs/produto/estoque/02-cadastro-de-itens.md#3-como-você-compra-opcional)", () => {
  it("item sem embalagem é aceito (comprado solto)", () => {
    expect(code(validateItem(itemData({ purchaseUnitLabel: null, purchaseFactor: null })))).toBe("OK");
  });

  it("embalagem sem quantidade aponta o campo da quantidade", () => {
    const r = validateItem(itemData({ purchaseFactor: null }));
    expect(code(r)).toBe("PURCHASE_FACTOR_REQUIRED");
    expect(field(r)).toBe("purchaseFactor");
  });

  it("quantidade sem embalagem aponta o campo da embalagem", () => {
    const r = validateItem(itemData({ purchaseUnitLabel: "  " }));
    expect(code(r)).toBe("PURCHASE_LABEL_REQUIRED");
    expect(field(r)).toBe("purchaseUnitLabel");
  });

  it("quantidade na embalagem precisa ser maior que zero", () => {
    expect(code(validateItem(itemData({ purchaseFactor: d("0") })))).toBe("INVALID_FACTOR");
    expect(code(validateItem(itemData({ purchaseFactor: d("-1") })))).toBe("INVALID_FACTOR");
  });

  it("nome da embalagem com no máximo 60 caracteres", () => {
    expect(field(validateItem(itemData({ purchaseUnitLabel: "x".repeat(61) })))).toBe("purchaseUnitLabel");
  });

  it("mostra a frase pronta: 1 Caixa = 20 kg", () => {
    expect(describePurchase(itemData())).toBe("1 Caixa = 20 kg");
    expect(describePurchase(itemData({ stockUnit: "un", purchaseUnitLabel: "Fardo", purchaseFactor: d("12") }))).toBe(
      "1 Fardo = 12 un",
    );
    expect(describePurchase(itemData({ stockUnit: "l", purchaseFactor: d("1.5") }))).toBe("1 Caixa = 1,5 l");
  });

  it("sem embalagem não há frase", () => {
    expect(describePurchase(itemData({ purchaseUnitLabel: null, purchaseFactor: null }))).toBeNull();
  });
});

describe("medida bloqueada após a 1ª movimentação (FR-023 da 001)", () => {
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

  it("manter a mesma medida nunca é bloqueado", () => {
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
