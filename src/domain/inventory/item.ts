import { d as dec, type Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";
import { convert, unitByCode, type ItemConversion, type Unit, type UnitCode } from "./units";
import type { Allergen } from "./allergens";
import type { StorageClass } from "./default-tree";

export const ITEM_TYPES = ["INGREDIENT", "RESALE", "PRODUCED", "CONSUMABLE", "ASSET"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  INGREDIENT: "Insumo",
  RESALE: "Revenda",
  PRODUCED: "Produzido",
  CONSUMABLE: "Consumo",
  ASSET: "Patrimônio",
};

export const COUNT_FREQUENCIES = ["SHIFT", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY"] as const;
export type CountFrequency = (typeof COUNT_FREQUENCIES)[number];

export const COUNT_FREQUENCY_LABELS: Record<CountFrequency, string> = {
  SHIFT: "Por turno",
  DAILY: "Diária",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
};

export type ConversionData = { fromUnit: UnitCode; toUnit: UnitCode; factor: Decimal };

/** Campos que o usuário informa no cadastro do item. */
export type ItemData = {
  description: string;
  type: ItemType;
  subgroupId: string;
  stockUnit: UnitCode;
  recipeUnit: UnitCode;
  purchaseUnitLabel: string;
  purchaseFactor: Decimal;
  conversions: ConversionData[];
  eanUnit: string | null;
  eanPackage: string | null;
  noGtin: boolean;
  financialCategory: string | null;
  presentation: string | null;
  netWeight: Decimal | null;
  drainedWeight: Decimal | null;
  catchWeight: boolean;
  correctionFactor: Decimal;
  yieldFactor: Decimal | null;
  storageTempMaxC: Decimal | null;
  receivingTempMinC: Decimal | null;
  receivingTempMaxC: Decimal | null;
  shelfLifeDays: number | null;
  openedLifeDays: number | null;
  lotControl: boolean;
  expiryAlertDays: number | null;
  allergens: Allergen[];
  ncm: string | null;
  cest: string | null;
  origin: string | null;
  taxGroup: string | null;
  countable: boolean;
  countFrequency: CountFrequency | null;
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
  abcClass: string | null;
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

function resolveConversions(data: Pick<ItemData, "conversions">): Result<ItemConversion[]> {
  const out: ItemConversion[] = [];
  for (const c of data.conversions) {
    const fromUnit = unitByCode(c.fromUnit);
    const toUnit = unitByCode(c.toUnit);
    if (!fromUnit || !toUnit) return err("UNKNOWN_UNIT", "conversions");
    if (fromUnit.dimension === toUnit.dimension)
      return err("VALIDATION", "conversions", { reason: "same_dimension" });
    if (c.factor.lte(0)) return err("INVALID_FACTOR", "conversions");
    out.push({ fromUnit, toUnit, factor: c.factor });
  }
  return ok(out);
}

/** Regras de identificação e unidades (FR-017, FR-020, FR-021). */
export function validateItemUnits(
  data: ItemData,
): Result<{ stock: Unit; recipe: Unit; conversions: ItemConversion[] }> {
  const description = data.description.trim();
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX)
    return err("INVALID_DESCRIPTION", "description");
  if (!ITEM_TYPES.includes(data.type)) return err("VALIDATION", "type");
  const stock = unitByCode(data.stockUnit);
  const recipe = unitByCode(data.recipeUnit);
  if (!stock) return err("UNKNOWN_UNIT", "stockUnit");
  if (!recipe) return err("UNKNOWN_UNIT", "recipeUnit");
  const label = data.purchaseUnitLabel.trim();
  if (label.length < 1 || label.length > 60) return err("VALIDATION", "purchaseUnitLabel");
  if (data.purchaseFactor.lte(0)) return err("INVALID_FACTOR", "purchaseFactor");
  const conv = resolveConversions(data);
  if (!conv.ok) return conv;
  const reachable = convert(dec(1), stock, recipe, conv.value);
  if (!reachable.ok)
    return err("MISSING_ITEM_CONVERSION", "conversions", { stockUnit: stock.code, recipeUnit: recipe.code });
  return ok({ stock, recipe, conversions: conv.value });
}

/** Todas as regras do cadastro. */
export function validateItem(data: ItemData): Result<void> {
  const units = validateItemUnits(data);
  if (!units.ok) return units;
  return ok(undefined);
}

/** Quantidade de compra → estoque → receita (FR-022). */
export function stockUnitEquivalence(
  data: ItemData,
  purchaseQty: Decimal,
): Result<{ purchase: Decimal; stock: Decimal; recipe: Decimal }> {
  const units = validateItemUnits(data);
  if (!units.ok) return units;
  const stock = purchaseQty.times(data.purchaseFactor);
  const recipe = convert(stock, units.value.stock, units.value.recipe, units.value.conversions);
  if (!recipe.ok) return recipe;
  return ok({ purchase: purchaseQty, stock, recipe: recipe.value });
}

/** FR-023: depois da 1ª movimentação a unidade de estoque não muda. */
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
