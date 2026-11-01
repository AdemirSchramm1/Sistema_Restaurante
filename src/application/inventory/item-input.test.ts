import { describe, it, expect } from "vitest";
import { parseItemForm } from "./item-input";

const base = {
  description: "Tomate italiano",
  subgroupId: "0193a000-0000-7000-8000-000000000123",
  type: "INGREDIENT",
  stockUnit: "kg",
  purchaseUnitLabel: "Caixa",
  purchaseFactor: "20",
};

describe("entrada do formulário de item (contracts/use-cases.md#itens)", () => {
  it("lê a quantidade da embalagem com vírgula decimal", () => {
    const r = parseItemForm({ ...base, purchaseFactor: "12,5" });
    expect(r.ok && r.value.purchaseFactor?.toString()).toBe("12.5");
  });

  it("embalagem e quantidade vazias viram nulo (comprado solto)", () => {
    const r = parseItemForm({ ...base, purchaseUnitLabel: " ", purchaseFactor: "" });
    expect(r).toMatchObject({ ok: true, value: { purchaseUnitLabel: null, purchaseFactor: null } });
  });

  it("rejeita campos que o usuário não pode enviar", () => {
    for (const extra of ["code", "averageCost", "lastCost", "abcClass", "restaurantId"]) {
      const r = parseItemForm({ ...base, [extra]: "x" });
      expect(r.ok, extra).toBe(false);
    }
  });

  it("rejeita os campos retirados do cadastro (sanitário, fiscal, contagem, receita)", () => {
    for (const removed of [
      "recipeUnit",
      "conversionFactor",
      "storageTempMaxC",
      "shelfLifeDays",
      "allergens",
      "ncm",
      "eanUnit",
      "countable",
      "countFrequency",
      "correctionFactor",
    ]) {
      const r = parseItemForm({ ...base, [removed]: "1" });
      expect(r.ok, removed).toBe(false);
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
});
