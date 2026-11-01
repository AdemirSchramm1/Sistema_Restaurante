import type { ItemData } from "@/domain/inventory/item";

const ITEM_DATA_KEYS = [
  "description",
  "type",
  "subgroupId",
  "stockUnit",
  "recipeUnit",
  "purchaseUnitLabel",
  "purchaseFactor",
  "eanUnit",
  "eanPackage",
  "noGtin",
  "financialCategory",
  "presentation",
  "netWeight",
  "drainedWeight",
  "catchWeight",
  "correctionFactor",
  "yieldFactor",
  "storageTempMaxC",
  "receivingTempMinC",
  "receivingTempMaxC",
  "shelfLifeDays",
  "openedLifeDays",
  "lotControl",
  "expiryAlertDays",
  "allergens",
  "ncm",
  "cest",
  "origin",
  "taxGroup",
  "countable",
  "countFrequency",
] as const satisfies readonly (keyof ItemData)[];

/** Forma do item gravada na auditoria (antes/depois). Só os campos que o usuário edita. */
export function itemAuditView(data: ItemData): Record<string, unknown> {
  const out: Record<string, unknown> = Object.fromEntries(ITEM_DATA_KEYS.map((k) => [k, data[k]]));
  out.description = data.description.trim();
  out.purchaseUnitLabel = data.purchaseUnitLabel.trim();
  out.conversions = data.conversions.map((c) => `1 ${c.fromUnit} = ${c.factor.toString()} ${c.toUnit}`);
  return out;
}
