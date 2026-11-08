import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import type { RecipeRecord } from "./ports";
import { refKey, type ComponentRef, type RecipeKind } from "@/domain/inventory/recipe";
import { recipeCost, usesItem, type RecipeNode } from "@/domain/inventory/recipe-graph";
import {
  costShare,
  evaluateProductCost,
  rankProductCosts,
  summarizeProductCosts,
  validateSalePrice,
  type ProductCost,
} from "@/domain/inventory/product-cost";
import type { Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

/** Painel de custo dos produtos (specs/008-painel-custo-produtos). */

const ENTITY = "recipe";

export type ProductCostPanel = { rows: ProductCost[]; summary: ReturnType<typeof summarizeProductCosts> };

export type ItemUsageRow = {
  id: string;
  name: string;
  kind: RecipeKind;
  cost: Decimal | null;
  salePrice: Decimal | null;
  share: Decimal | null;
};

const priceText = (p: Decimal | null) => (p ? p.toFixed(2) : null);

/** Define ou tira o preço de venda de um produto vendido (US1). Não cria versão. */
export async function setRecipeSalePrice(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  salePrice: Decimal | null,
): Promise<Result<{ version: number }>> {
  const allowed = await authorize(deps, ctx, "recipe.write", ENTITY, id);
  if (!allowed.ok) return allowed;
  const valid = validateSalePrice(salePrice);
  if (!valid.ok) return valid;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.recipes.get(id);
    if (!current) return err("NOT_FOUND");
    if (current.kind !== "DISH") return err("PRICE_ONLY_FOR_DISH", "salePrice");
    const r = await repos.recipes.setSalePrice(id, salePrice, version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    const before = priceText(current.salePrice);
    const after = priceText(salePrice);
    if (before !== after)
      await repos.audit.record({
        entity: ENTITY,
        entityId: id,
        action: "UPDATE",
        changes: { salePrice: [before, after] },
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok({ version: version + 1 });
  });
}

/** Grafo de preparos e o que se sabe de cada item e preparo usado pelos produtos, numa leitura só. */
async function costing(repos: Repos, records: readonly RecipeRecord[]) {
  const graph = await repos.recipes.subRecipeGraph();
  const refs = new Map<string, ComponentRef>();
  const addAll = (lines: RecipeNode["lines"]) =>
    lines.forEach((l) => refs.set(refKey(l.component), l.component));
  records.forEach((r) => addAll(r.current.lines));
  graph.forEach((n) => addAll(n.lines));
  const found = await repos.recipes.components([...refs.values()]);
  const byKey = new Map(found.map((c) => [refKey(c.ref), c]));
  const item = (id: string) => {
    const c = byKey.get(refKey({ kind: "ITEM", id }));
    return c ? { stockUnit: c.unit, averageCost: c.averageCost } : undefined;
  };
  const nameOf = (ref: ComponentRef) => byKey.get(refKey(ref))?.name ?? "?";
  const evaluate = (r: RecipeRecord): ProductCost => {
    const cost = recipeCost(r.current.lines, graph, item);
    return evaluateProductCost({
      id: r.id,
      name: r.name,
      salePrice: r.kind === "DISH" ? r.salePrice : null,
      cost: cost.total,
      lines: r.current.lines.map((l, i) => ({ name: nameOf(l.component), cost: cost.lines[i]!.cost })),
      missingCostNames: cost.missingItemIds.map((id) => nameOf({ kind: "ITEM", id })),
    });
  };
  return { graph, evaluate };
}

/** Custo de uma unidade de cada produto vendido ativo, na ordem do painel, e o resumo (US2). */
export async function listProductCosts(deps: Deps, ctx: RequestContext): Promise<Result<ProductCostPanel>> {
  const allowed = await authorize(deps, ctx, "catalog.read", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const dishes = (await repos.recipes.activeWithLatest()).filter((r) => r.kind === "DISH");
    const { evaluate } = await costing(repos, dishes);
    const rows = rankProductCosts(dishes.map(evaluate));
    return ok({ rows, summary: summarizeProductCosts(rows) });
  });
}

/** Produtos ativos que usam o item direto ou dentro de um preparo, com custo e % do preço (US3). */
export async function itemUsage(
  deps: Deps,
  ctx: RequestContext,
  itemId: string,
): Promise<Result<ItemUsageRow[]>> {
  const allowed = await authorize(deps, ctx, "catalog.read", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const all = await repos.recipes.activeWithLatest();
    const graph = await repos.recipes.subRecipeGraph();
    const using = all.filter((r) => usesItem(r.current.lines, itemId, graph));
    const { evaluate } = await costing(repos, using);
    return ok(
      using.map((r) => {
        const p = evaluate(r);
        return {
          id: r.id,
          name: r.name,
          kind: r.kind,
          cost: p.cost,
          salePrice: p.salePrice,
          share: p.cost && p.salePrice ? costShare(p.cost, p.salePrice) : null,
        };
      }),
    );
  });
}
