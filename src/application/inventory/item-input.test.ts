import { describe, it, expect } from "vitest";
import { parseItemForm } from "./item-input";

const base = {
  description: "Tomate italiano, caixa 20 kg, tipo AA",
  subgroupId: "0193a000-0000-7000-8000-000000000123",
  type: "INGREDIENT",
  stockUnit: "kg",
  recipeUnit: "g",
  purchaseUnitLabel: "Caixa 20 kg",
  purchaseFactor: "20",
};

describe("entrada do formulário de item (contracts/use-cases.md#itens)", () => {
  it("lê números com vírgula decimal", () => {
    const r = parseItemForm({ ...base, purchaseFactor: "12,5", correctionFactor: "1,25" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.purchaseFactor.toString()).toBe("12.5");
      expect(r.value.correctionFactor.toString()).toBe("1.25");
    }
  });

  it("monta a conversão do item quando estoque e receita têm dimensões diferentes", () => {
    const r = parseItemForm({ ...base, stockUnit: "un", recipeUnit: "g", conversionFactor: "50" });
    expect(r.ok && r.value.conversions.map((c) => [c.fromUnit, c.toUnit, c.factor.toString()])).toEqual([
      ["un", "g", "50"],
    ]);
  });

  it("rejeita campos que o usuário não pode enviar", () => {
    for (const extra of ["code", "averageCost", "lastCost", "abcClass", "restaurantId"]) {
      const r = parseItemForm({ ...base, [extra]: "x" });
      expect(r.ok, extra).toBe(false);
    }
  });

  it("aponta o campo numérico inválido", () => {
    const r = parseItemForm({ ...base, purchaseFactor: "vinte" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("INVALID_NUMBER");
      expect(r.error.field).toBe("purchaseFactor");
    }
  });

  it("checkbox marcado vira true e ausente vira false", () => {
    const r = parseItemForm({ ...base, catchWeight: "on" });
    expect(r.ok && r.value.catchWeight).toBe(true);
    expect(r.ok && r.value.lotControl).toBe(false);
    expect(r.ok && r.value.countable).toBe(false);
  });

  it("alérgenos chegam como lista", () => {
    const r = parseItemForm({ ...base, allergens: ["MILK", "EGGS"] });
    expect(r.ok && r.value.allergens).toEqual(["MILK", "EGGS"]);
  });
});
