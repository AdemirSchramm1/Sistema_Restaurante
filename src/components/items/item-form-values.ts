import { formatBrDecimal } from "@/domain/shared/decimal";
import type { Item } from "@/domain/inventory/item";

/** Valores do formulário de item, sempre como texto (vírgula decimal). */
export type ItemFormValues = Record<string, string | boolean | string[]>;

export const emptyItemValues: ItemFormValues = {
  description: "",
  subgroupId: "",
  type: "INGREDIENT",
  stockUnit: "kg",
  purchaseUnitLabel: "",
  purchaseFactor: "",
};

export function itemToValues(item: Item): ItemFormValues {
  return {
    description: item.description,
    subgroupId: item.subgroupId,
    type: item.type,
    stockUnit: item.stockUnit,
    purchaseUnitLabel: item.purchaseUnitLabel ?? "",
    purchaseFactor: item.purchaseFactor ? formatBrDecimal(item.purchaseFactor, { maxPlaces: 4 }) : "",
  };
}
