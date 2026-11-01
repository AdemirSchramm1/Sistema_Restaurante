import type { ItemData } from "@/domain/inventory/item";

const ITEM_DATA_KEYS = [
  "description",
  "type",
  "subgroupId",
  "stockUnit",
  "purchaseUnitLabel",
  "purchaseFactor",
] as const satisfies readonly (keyof ItemData)[];

/** Forma do item gravada na auditoria (antes/depois). Só os campos que o usuário edita. */
export function itemAuditView(data: ItemData): Record<string, unknown> {
  const out: Record<string, unknown> = Object.fromEntries(ITEM_DATA_KEYS.map((k) => [k, data[k]]));
  out.description = data.description.trim();
  out.purchaseUnitLabel = data.purchaseUnitLabel?.trim() || null;
  return out;
}
