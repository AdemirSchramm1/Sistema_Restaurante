import { describe, it, expect } from "vitest";
import type { Item } from "@/domain/inventory/item";
import { d } from "@/domain/shared/decimal";
import { itemToValues } from "./item-form-values";

const item = (over: Partial<Item>): Item => ({
  id: "i1",
  code: "01.01.0001",
  description: "Tomate italiano",
  type: "INGREDIENT",
  subgroupId: "s1",
  stockUnit: "kg",
  purchaseUnitLabel: "Caixa",
  purchaseFactor: d("20.125"),
  active: true,
  version: 1,
  inCogsOverride: null,
  stockUnitLockedAt: null,
  averageCost: null,
  lastCost: null,
  costUpdatedAt: null,
  reorderPoint: null,
  parLevel: null,
  groupId: "g1",
  groupName: "Hortifruti",
  subgroupName: "Legumes",
  storageClass: "FOOD",
  groupInCogs: true,
  ...over,
});

describe("valores do formulário de item", () => {
  it("decimal com vírgula e até 4 casas", () => {
    expect(itemToValues(item({}))).toEqual({
      description: "Tomate italiano",
      subgroupId: "s1",
      type: "INGREDIENT",
      stockUnit: "kg",
      purchaseUnitLabel: "Caixa",
      purchaseFactor: "20,125",
    });
  });

  it("sem embalagem de compra, campos vazios", () => {
    const v = itemToValues(item({ purchaseUnitLabel: null, purchaseFactor: null }));
    expect(v.purchaseUnitLabel).toBe("");
    expect(v.purchaseFactor).toBe("");
  });
});
