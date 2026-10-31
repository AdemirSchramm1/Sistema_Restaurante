import type { Decimal } from "../shared/decimal";
import type { UnitCode } from "./units";
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
