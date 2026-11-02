import type { Decimal } from "../shared/decimal";
import { d } from "../shared/decimal";
import { ok, type Result } from "../shared/result";

/** Painel de custo dos produtos (spec 008). Esqueleto: o comportamento vem depois do teste. */

export type CostBand = "OK" | "WARN" | "HIGH";

export type ProductCostInput = {
  id: string;
  name: string;
  salePrice: Decimal | null;
  cost: Decimal | null;
  lines: { name: string; cost: Decimal | null }[];
  missingCostNames: string[];
};

export type ProductCost = ProductCostInput & {
  share: Decimal | null;
  band: CostBand | null;
  margin: Decimal | null;
  heaviest: { name: string; cost: Decimal; share: Decimal } | null;
};

export const costShare = (_cost: Decimal, _price: Decimal): Decimal => d(0);
export const costBand = (_share: Decimal): CostBand => "OK";
export const costBarPercent = (_share: Decimal): number => 0;
export const evaluateProductCost = (p: ProductCostInput): ProductCost => ({
  ...p,
  share: null,
  band: null,
  margin: null,
  heaviest: null,
});
export const rankProductCosts = (rows: readonly ProductCost[]): ProductCost[] => [...rows];
export const summarizeProductCosts = (_rows: readonly ProductCost[]) => ({
  total: 0,
  high: 0,
  warn: 0,
  ok: 0,
  noPrice: 0,
  noCost: 0,
});
export const validateSalePrice = (_price: Decimal | null): Result<void> => ok(undefined);
