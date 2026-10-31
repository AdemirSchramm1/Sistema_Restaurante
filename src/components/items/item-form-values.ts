import { formatBrDecimal, type Decimal } from "@/domain/shared/decimal";
import type { Item } from "@/domain/inventory/item";

/** Valores do formulário de item, sempre como texto (vírgula decimal). */
export type ItemFormValues = Record<string, string | boolean | string[]>;

const n = (v: Decimal | null) => (v ? formatBrDecimal(v, { maxPlaces: 4 }) : "");
const i = (v: number | null) => (v == null ? "" : String(v));
const t = (v: string | null) => v ?? "";

export const emptyItemValues: ItemFormValues = {
  description: "",
  subgroupId: "",
  type: "INGREDIENT",
  stockUnit: "kg",
  recipeUnit: "g",
  purchaseUnitLabel: "",
  purchaseFactor: "",
  conversionFactor: "",
  correctionFactor: "1",
  countable: true,
  allergens: [],
};

export function itemToValues(item: Item): ItemFormValues {
  const conv = item.conversions.find((c) => c.fromUnit === item.stockUnit && c.toUnit === item.recipeUnit);
  return {
    description: item.description,
    subgroupId: item.subgroupId,
    type: item.type,
    stockUnit: item.stockUnit,
    recipeUnit: item.recipeUnit,
    purchaseUnitLabel: item.purchaseUnitLabel,
    purchaseFactor: n(item.purchaseFactor),
    conversionFactor: conv ? n(conv.factor) : "",
    eanUnit: t(item.eanUnit),
    eanPackage: t(item.eanPackage),
    noGtin: item.noGtin,
    financialCategory: t(item.financialCategory),
    presentation: t(item.presentation),
    netWeight: n(item.netWeight),
    drainedWeight: n(item.drainedWeight),
    catchWeight: item.catchWeight,
    correctionFactor: n(item.correctionFactor),
    yieldFactor: n(item.yieldFactor),
    storageTempMaxC: n(item.storageTempMaxC),
    receivingTempMinC: n(item.receivingTempMinC),
    receivingTempMaxC: n(item.receivingTempMaxC),
    shelfLifeDays: i(item.shelfLifeDays),
    openedLifeDays: i(item.openedLifeDays),
    lotControl: item.lotControl,
    expiryAlertDays: i(item.expiryAlertDays),
    allergens: item.allergens,
    ncm: t(item.ncm),
    cest: t(item.cest),
    origin: t(item.origin),
    taxGroup: t(item.taxGroup),
    countable: item.countable,
    countFrequency: t(item.countFrequency),
  };
}
