import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import type { ComponentRecord, RecipeFilter, RecipeListRow, RecipeVersionRecord } from "./ports";
import {
  checkSubRecipeChange,
  hasVersionChanges,
  refKey,
  validateRecipe,
  type ComponentRef,
  type RecipeData,
  type RecipeKind,
  type RecipeLineData,
} from "@/domain/inventory/recipe";
import { recipeCost } from "@/domain/inventory/recipe-graph";
import { normalizeDescription } from "@/domain/inventory/description";
import type { UnitCode } from "@/domain/inventory/units";
import { formatBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { diffFields } from "@/domain/shared/audit";
import { err, ok, type Result } from "@/domain/shared/result";

/** Produtos e preparos (specs/003-produtos). */

const ENTITY = "recipe";

async function lookupFor(repos: Repos, refs: readonly ComponentRef[]) {
  const unique = [...new Map(refs.map((r) => [refKey(r), r])).values()];
  const found = await repos.recipes.components(unique);
  const byKey = new Map(found.map((c) => [refKey(c.ref), c]));
  return (ref: ComponentRef) => byKey.get(refKey(ref));
}

/** Forma gravada na auditoria: nomes legíveis, sem ids. */
function auditView(
  data: Pick<RecipeData, "name" | "kind" | "yieldQuantity" | "yieldUnit" | "lines">,
  lookup: (ref: ComponentRef) => ComponentRecord | undefined,
) {
  const qty = (q: Decimal, u: UnitCode) => `${formatBrDecimal(q)} ${u}`;
  return {
    name: data.name.trim(),
    kind: data.kind,
    yield: data.yieldQuantity && data.yieldUnit ? qty(data.yieldQuantity, data.yieldUnit) : null,
    lines: data.lines
      .map((l) => `${lookup(l.component)?.name ?? "?"}: ${qty(l.quantity, l.unit)}`)
      .join("; "),
  };
}

const sameName = (normalized: string, repos: Repos, exceptId?: string) =>
  repos.recipes.findActiveByName(normalized, exceptId);

export async function createRecipe(
  deps: Deps,
  ctx: RequestContext,
  data: RecipeData,
): Promise<Result<{ id: string }>> {
  const allowed = await authorize(deps, ctx, "recipe.write", ENTITY);
  if (!allowed.ok) return allowed;

  return deps.tenant(ctx.restaurantId, async (repos) => {
    const lookup = await lookupFor(
      repos,
      data.lines.map((l) => l.component),
    );
    const valid = validateRecipe(data, lookup, { graph: await repos.recipes.subRecipeGraph() });
    if (!valid.ok) return valid;

    const normalized = normalizeDescription(data.name);
    if (await sameName(normalized, repos)) return err("RECIPE_DUPLICATE_NAME", "name");

    const id = deps.ids.next();
    const stamp = auditStamp(deps, ctx);
    const inserted = await repos.recipes.insert(
      { id, name: data.name, nameNormalized: normalized, kind: data.kind },
      stamp,
    );
    if (!inserted.ok) return inserted;
    await repos.recipes.insertVersion(
      { id: deps.ids.next(), recipeId: id, number: 1, validFrom: stamp.at, ...versionContent(data) },
      () => deps.ids.next(),
      stamp,
    );
    await repos.audit.record({
      entity: ENTITY,
      entityId: id,
      action: "CREATE",
      changes: diffFields(null, auditView(data, lookup)),
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ id });
  });
}

const versionContent = (data: RecipeData) => ({
  yieldQuantity: data.kind === "SUB_RECIPE" ? data.yieldQuantity : null,
  yieldUnit: data.kind === "SUB_RECIPE" ? data.yieldUnit : null,
  lines: data.lines,
});

/** Edita com trava otimista. Linhas ou rendimento diferentes geram versão nova (FR-004). */
export async function updateRecipe(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  data: RecipeData,
): Promise<Result<{ version: number; versionNumber: number | null }>> {
  const allowed = await authorize(deps, ctx, "recipe.write", ENTITY, id);
  if (!allowed.ok) return allowed;

  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.recipes.get(id);
    if (!current) return err("NOT_FOUND");
    if (current.version !== version) return err("STALE_RECORD");

    const lookup = await lookupFor(repos, [
      ...data.lines.map((l) => l.component),
      ...current.current.lines.map((l) => l.component),
    ]);
    const valid = validateRecipe(data, lookup, {
      previous: current.current.lines,
      selfId: id,
      graph: await repos.recipes.subRecipeGraph(),
    });
    if (!valid.ok) return valid;

    const inUse = current.kind === "SUB_RECIPE" ? await repos.recipes.usedBy(id) : [];
    const change = checkSubRecipeChange(
      { kind: current.kind, yieldUnit: current.current.yieldUnit },
      { kind: data.kind, yieldUnit: data.yieldUnit },
      inUse,
    );
    if (!change.ok) return change;

    const normalized = normalizeDescription(data.name);
    if (current.active && (await sameName(normalized, repos, id)))
      return err("RECIPE_DUPLICATE_NAME", "name");

    const stamp = auditStamp(deps, ctx);
    const updated = await repos.recipes.update(
      id,
      { name: data.name, nameNormalized: normalized, kind: data.kind },
      version,
      stamp,
    );
    if (!updated.ok) return updated;

    const content = versionContent(data);
    let versionNumber: number | null = null;
    if (hasVersionChanges(current.current, content)) {
      versionNumber = current.current.number + 1;
      await repos.recipes.insertVersion(
        { id: deps.ids.next(), recipeId: id, number: versionNumber, validFrom: stamp.at, ...content },
        () => deps.ids.next(),
        stamp,
      );
    }

    const changes = diffFields(
      auditView({ name: current.name, kind: current.kind, ...current.current }, lookup),
      auditView(data, lookup),
    );
    if (Object.keys(changes).length)
      await repos.audit.record({
        entity: ENTITY,
        entityId: id,
        action: "UPDATE",
        changes,
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok({ version: version + 1, versionNumber });
  });
}

/** Inativa ou reativa; preparo em uso não inativa (FR-010). Nunca apaga. */
export async function setRecipeActive(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  active: boolean,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "recipe.write", ENTITY, id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.recipes.get(id);
    if (!current) return err("NOT_FOUND");
    if (!active) {
      const usedBy = current.kind === "SUB_RECIPE" ? await repos.recipes.usedBy(id) : [];
      const change = checkSubRecipeChange(
        { kind: current.kind, yieldUnit: current.current.yieldUnit },
        null,
        usedBy,
      );
      if (!change.ok) return change;
    }
    const r = await repos.recipes.setActive(id, active, version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    await repos.audit.record({
      entity: ENTITY,
      entityId: id,
      action: active ? "REACTIVATE" : "DEACTIVATE",
      changes: { active: [!active, active] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

export async function listRecipes(
  deps: Deps,
  ctx: RequestContext,
  filter: RecipeFilter,
): Promise<Result<RecipeListRow[]>> {
  const allowed = await authorize(deps, ctx, "catalog.read", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) =>
    ok(await repos.recipes.list({ ...filter, status: filter.status ?? "active" })),
  );
}

export type RecipeLineView = {
  componentKind: ComponentRef["kind"];
  componentId: string;
  name: string;
  componentActive: boolean;
  quantity: Decimal;
  unit: UnitCode;
  /** Unidade do item ou do rendimento do preparo. */
  componentUnit: UnitCode;
  cost: Decimal | null;
  missingCostNames: string[];
};

export type RecipeView = {
  recipe: {
    id: string;
    name: string;
    kind: RecipeKind;
    active: boolean;
    version: number;
    yieldQuantity: Decimal | null;
    yieldUnit: UnitCode | null;
  };
  /** Preço de venda (só produto vendido; spec 008). */
  salePrice: Decimal | null;
  versionNumber: number;
  validFrom: Date;
  lines: RecipeLineView[];
  /** Custo total, ou null quando falta custo médio em algum item. */
  total: Decimal | null;
  missingCostNames: string[];
  /** Preparo: custo de 1 unidade do rendimento (ex.: por kg). */
  costPerYieldUnit: Decimal | null;
  /** Produtos ativos que usam este preparo. */
  usedBy: string[];
};

export async function getRecipe(deps: Deps, ctx: RequestContext, id: string): Promise<Result<RecipeView>> {
  const allowed = await authorize(deps, ctx, "catalog.read", ENTITY, id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const r = await repos.recipes.get(id);
    if (!r) return err("NOT_FOUND");
    const graph = await repos.recipes.subRecipeGraph();
    const refs: ComponentRef[] = [
      ...r.current.lines.map((l) => l.component),
      ...[...graph.values()].flatMap((n) => n.lines.map((l) => l.component)),
    ];
    const lookup = await lookupFor(repos, refs);
    const itemInfo = (itemId: string) => {
      const c = lookup({ kind: "ITEM", id: itemId });
      return c ? { stockUnit: c.unit, averageCost: c.averageCost } : undefined;
    };
    const nameOf = (itemId: string) => lookup({ kind: "ITEM", id: itemId })?.name ?? "?";
    const cost = recipeCost(r.current.lines, graph, itemInfo);
    const v = r.current;
    return ok({
      recipe: {
        id: r.id,
        name: r.name,
        kind: r.kind,
        active: r.active,
        version: r.version,
        yieldQuantity: v.yieldQuantity,
        yieldUnit: v.yieldUnit,
      },
      salePrice: null,
      versionNumber: v.number,
      validFrom: v.validFrom,
      lines: v.lines.map((l: RecipeLineData, i): RecipeLineView => {
        const c = lookup(l.component);
        return {
          componentKind: l.component.kind,
          componentId: l.component.id,
          name: c?.name ?? "?",
          componentActive: c?.active ?? false,
          quantity: l.quantity,
          unit: l.unit,
          componentUnit: c?.unit ?? l.unit,
          cost: cost.lines[i]!.cost,
          missingCostNames: cost.lines[i]!.missingItemIds.map(nameOf),
        };
      }),
      total: cost.total,
      missingCostNames: cost.missingItemIds.map(nameOf),
      costPerYieldUnit: cost.total && v.yieldQuantity ? cost.total.dividedBy(v.yieldQuantity) : null,
      usedBy: r.kind === "SUB_RECIPE" ? await repos.recipes.usedBy(id) : [],
    });
  });
}

/** Versão vigente numa data: é a que a baixa por pedido (feature 005) vai usar. */
export async function getRecipeVersionAt(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  at: Date,
): Promise<Result<RecipeVersionRecord | null>> {
  const allowed = await authorize(deps, ctx, "catalog.read", ENTITY, id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => ok(await repos.recipes.versionAt(id, at)));
}

export type ComponentOption = { id: string; label: string; unit: UnitCode };

/** O que pode entrar numa linha: itens ativos e preparos ativos (menos o próprio). */
export async function recipeFormOptions(
  deps: Deps,
  ctx: RequestContext,
  exceptRecipeId?: string,
): Promise<Result<{ items: ComponentOption[]; preps: ComponentOption[] }>> {
  const allowed = await authorize(deps, ctx, "catalog.read", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const all = await repos.recipes.activeComponents();
    const opt = (c: ComponentRecord): ComponentOption => ({ id: c.ref.id, label: c.name, unit: c.unit });
    return ok({
      items: all.filter((c) => c.ref.kind === "ITEM").map(opt),
      preps: all.filter((c) => c.ref.kind === "RECIPE" && c.ref.id !== exceptRecipeId).map(opt),
    });
  });
}
