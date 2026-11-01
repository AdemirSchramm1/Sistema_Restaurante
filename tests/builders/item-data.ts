import { d } from "../../src/domain/shared/decimal";
import type { ItemData } from "../../src/domain/inventory/item";

/** Dados válidos de item para testes: tomate em kg, comprado em caixa de 20 kg. */
export function itemData(over: Partial<ItemData> = {}): ItemData {
  return {
    description: "Tomate italiano",
    type: "INGREDIENT",
    subgroupId: "sub",
    stockUnit: "kg",
    purchaseUnitLabel: "Caixa",
    purchaseFactor: d("20"),
    ...over,
  };
}
