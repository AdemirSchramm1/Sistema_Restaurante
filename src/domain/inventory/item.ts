import { formatBrDecimal, type Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";
import { unitByCode, type UnitCode } from "./units";
import type { StorageClass } from "./default-tree";

export const ITEM_TYPES = ["INGREDIENT", "RESALE", "PRODUCED", "CONSUMABLE", "ASSET"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  INGREDIENT: "Ingrediente",
  RESALE: "Revenda",
  PRODUCED: "Feito na cozinha",
  CONSUMABLE: "Material de uso",
  ASSET: "Equipamento",
};

/** Explicação curta de cada tipo, mostrada na tela. */
export const ITEM_TYPE_HINTS: Record<ItemType, string> = {
  INGREDIENT: "vai nos pratos (carne, arroz, tomate)",
  RESALE: "vendido como chega (refrigerante, cerveja)",
  PRODUCED: "preparado aqui (molho, massa pronta)",
  CONSUMABLE: "limpeza e descartáveis",
  ASSET: "panelas, utensílios",
};

/** Campos que o usuário informa no cadastro do item (docs/produto/estoque/02-cadastro-de-itens.md). */
export type ItemData = {
  description: string;
  type: ItemType;
  subgroupId: string;
  /** A medida do item: é nela que o saldo fica e baixa a cada pedido. */
  stockUnit: UnitCode;
  /** Embalagem de compra (opcional): "Caixa", "Saco". */
  purchaseUnitLabel: string | null;
  /** Quanto vem em cada embalagem, na medida do item. */
  purchaseFactor: Decimal | null;
};

/** Item como está gravado, com os campos que o sistema mantém. */
export type Item = ItemData & {
  id: string;
  code: string;
  active: boolean;
  version: number;
  inCogsOverride: boolean | null;
  stockUnitLockedAt: Date | null;
  averageCost: Decimal | null;
  lastCost: Decimal | null;
  costUpdatedAt: Date | null;
  /** Aviso de reposição (spec 006): "avisar quando chegar em" e "comprar até". */
  reorderPoint: Decimal | null;
  parLevel: Decimal | null;
  groupId: string;
  groupName: string;
  subgroupName: string;
  storageClass: StorageClass;
  groupInCogs: boolean;
};

// ---------------------------------------------------------------------------
// Regras

export const DESCRIPTION_MIN = 3;
export const DESCRIPTION_MAX = 200;
export const PURCHASE_LABEL_MAX = 60;

const blank = (s: string | null) => !s || !s.trim();

/** Todas as regras do cadastro. */
export function validateItem(data: ItemData): Result<void> {
  const description = data.description.trim();
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX)
    return err("INVALID_DESCRIPTION", "description");
  if (!ITEM_TYPES.includes(data.type)) return err("VALIDATION", "type");
  if (!unitByCode(data.stockUnit)) return err("UNKNOWN_UNIT", "stockUnit");

  const hasLabel = !blank(data.purchaseUnitLabel);
  const hasFactor = data.purchaseFactor !== null;
  if (hasLabel && !hasFactor) return err("PURCHASE_FACTOR_REQUIRED", "purchaseFactor");
  if (hasFactor && !hasLabel) return err("PURCHASE_LABEL_REQUIRED", "purchaseUnitLabel");
  if (hasLabel && data.purchaseUnitLabel!.trim().length > PURCHASE_LABEL_MAX)
    return err("VALIDATION", "purchaseUnitLabel");
  if (hasFactor && data.purchaseFactor!.lte(0)) return err("INVALID_FACTOR", "purchaseFactor");
  return ok(undefined);
}

/** Frase pronta da embalagem: "1 Caixa = 20 kg". Sem embalagem, null. */
export function describePurchase(
  data: Pick<ItemData, "purchaseUnitLabel" | "purchaseFactor" | "stockUnit">,
): string | null {
  if (blank(data.purchaseUnitLabel) || !data.purchaseFactor || data.purchaseFactor.lte(0)) return null;
  return `1 ${data.purchaseUnitLabel!.trim()} = ${formatBrDecimal(data.purchaseFactor)} ${data.stockUnit}`;
}

/** A medida não muda depois da 1ª movimentação. */
export function canChangeStockUnit(
  item: { stockUnit: UnitCode; stockUnitLockedAt: Date | null },
  newUnit: UnitCode,
): Result<void> {
  if (item.stockUnit !== newUnit && item.stockUnitLockedAt) return err("ITEM_UNIT_LOCKED", "stockUnit");
  return ok(undefined);
}

/** "Entra no CMV" vem do grupo; o item pode sobrescrever (FR-024). */
export function effectiveInCogs(item: { groupInCogs: boolean; inCogsOverride: boolean | null }): boolean {
  return item.inCogsOverride ?? item.groupInCogs;
}
