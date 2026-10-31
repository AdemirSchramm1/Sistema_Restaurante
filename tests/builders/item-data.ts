import { d } from "../../src/domain/shared/decimal";
import type { ItemData } from "../../src/domain/inventory/item";

/** Dados válidos de item para testes: o tomate do cenário 1.1 da spec. */
export function itemData(over: Partial<ItemData> = {}): ItemData {
  return {
    description: "Tomate italiano, caixa 20 kg, tipo AA",
    type: "INGREDIENT",
    subgroupId: "sub",
    stockUnit: "kg",
    recipeUnit: "g",
    purchaseUnitLabel: "Caixa 20 kg",
    purchaseFactor: d("20"),
    conversions: [],
    eanUnit: null,
    eanPackage: null,
    noGtin: false,
    financialCategory: null,
    presentation: null,
    netWeight: null,
    drainedWeight: null,
    catchWeight: false,
    correctionFactor: d("1"),
    yieldFactor: null,
    storageTempMaxC: null,
    receivingTempMinC: null,
    receivingTempMaxC: null,
    shelfLifeDays: null,
    openedLifeDays: null,
    lotControl: false,
    expiryAlertDays: null,
    allergens: [],
    ncm: null,
    cest: null,
    origin: null,
    taxGroup: null,
    countable: true,
    countFrequency: null,
    ...over,
  };
}
