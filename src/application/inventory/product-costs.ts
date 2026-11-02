import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import type { RecipeKind } from "@/domain/inventory/recipe";
import type { ProductCost, summarizeProductCosts } from "@/domain/inventory/product-cost";
import type { Decimal } from "@/domain/shared/decimal";
import { ok, type Result } from "@/domain/shared/result";

/** Painel de custo dos produtos (specs/008-painel-custo-produtos). Esqueleto. */

export type ProductCostPanel = { rows: ProductCost[]; summary: ReturnType<typeof summarizeProductCosts> };

export type ItemUsageRow = {
  id: string;
  name: string;
  kind: RecipeKind;
  cost: Decimal | null;
  salePrice: Decimal | null;
  share: Decimal | null;
};

export async function setRecipeSalePrice(
  _deps: Deps,
  _ctx: RequestContext,
  _id: string,
  version: number,
  _salePrice: Decimal | null,
): Promise<Result<{ version: number }>> {
  return ok({ version });
}

export async function listProductCosts(_deps: Deps, _ctx: RequestContext): Promise<Result<ProductCostPanel>> {
  return ok({ rows: [], summary: { total: 0, high: 0, warn: 0, ok: 0, noPrice: 0, noCost: 0 } });
}

export async function itemUsage(
  _deps: Deps,
  _ctx: RequestContext,
  _itemId: string,
): Promise<Result<ItemUsageRow[]>> {
  return ok([]);
}
