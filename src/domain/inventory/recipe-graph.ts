import { d, type Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";
import { convert, unitByCode, type UnitCode } from "./units";
import type { RecipeData, RecipeLineData } from "./recipe";

/** Versão vigente de um preparo, como o grafo precisa. */
export type RecipeNode = RecipeData & { id: string };
export type ItemCostInfo = { stockUnit: UnitCode; averageCost: Decimal | null };

/**
 * Caminho do ciclo se o produto `selfId` (com estas linhas) acabar usando a si mesmo pelos preparos,
 * ou null. Ex.: ["a", "b", "a"].
 */
export function findCycle(
  selfId: string | null,
  lines: readonly RecipeLineData[],
  graph: Map<string, RecipeNode>,
): string[] | null {
  if (!selfId) return null;
  const visit = (id: string, path: string[], seen: Set<string>): string[] | null => {
    if (id === selfId) return [...path, id];
    if (seen.has(id)) return null;
    seen.add(id);
    for (const l of graph.get(id)?.lines ?? [])
      if (l.component.kind === "RECIPE") {
        const found = visit(l.component.id, [...path, id], seen);
        if (found) return found;
      }
    return null;
  };
  const seen = new Set<string>();
  for (const l of lines)
    if (l.component.kind === "RECIPE") {
      const found = visit(l.component.id, [selfId], seen);
      if (found) return found;
    }
  return null;
}

function toUnit(qty: Decimal, from: UnitCode, to: UnitCode): Result<Decimal> {
  const a = unitByCode(from);
  const b = unitByCode(to);
  if (!a || !b) return err("UNKNOWN_UNIT");
  return convert(qty, a, b);
}

/**
 * Transforma `times` vezes estas linhas na quantidade de cada item, na medida do item,
 * descendo pelos preparos (FR-009). É o que a baixa automática vai lançar.
 */
export function explode(
  lines: readonly RecipeLineData[],
  times: Decimal,
  graph: Map<string, RecipeNode>,
  items: (id: string) => ItemCostInfo | undefined,
  depth = 0,
): Result<Map<string, Decimal>> {
  if (depth > 32) return err("RECIPE_CYCLE");
  const out = new Map<string, Decimal>();
  const add = (id: string, q: Decimal) => out.set(id, (out.get(id) ?? d(0)).plus(q));
  for (const line of lines) {
    const qty = line.quantity.times(times);
    if (line.component.kind === "ITEM") {
      const item = items(line.component.id);
      if (!item) return err("NOT_FOUND", undefined, { itemId: line.component.id });
      const q = toUnit(qty, line.unit, item.stockUnit);
      if (!q.ok) return q;
      add(line.component.id, q.value);
      continue;
    }
    const prep = graph.get(line.component.id);
    if (!prep || !prep.yieldQuantity || !prep.yieldUnit)
      return err("NOT_FOUND", undefined, { recipeId: line.component.id });
    const inYield = toUnit(qty, line.unit, prep.yieldUnit);
    if (!inYield.ok) return inYield;
    const inner = explode(prep.lines, inYield.value.dividedBy(prep.yieldQuantity), graph, items, depth + 1);
    if (!inner.ok) return inner;
    for (const [id, q] of inner.value) add(id, q);
  }
  return ok(out);
}

export type LineCost = { cost: Decimal | null; missingItemIds: string[] };
export type RecipeCost = { lines: LineCost[]; total: Decimal | null; missingItemIds: string[] };

/** Custo de cada linha e do produto pelo custo médio dos itens (FR-005). Sem arredondar. */
export function recipeCost(
  lines: readonly RecipeLineData[],
  graph: Map<string, RecipeNode>,
  items: (id: string) => ItemCostInfo | undefined,
): RecipeCost {
  const out: LineCost[] = lines.map((line) => {
    const exploded = explode([line], d(1), graph, items);
    if (!exploded.ok) return { cost: null, missingItemIds: [] };
    let cost = d(0);
    const missing: string[] = [];
    for (const [id, q] of exploded.value) {
      const c = items(id)?.averageCost;
      if (!c) missing.push(id);
      else cost = cost.plus(q.times(c));
    }
    return { cost: missing.length ? null : cost, missingItemIds: missing };
  });
  const missingItemIds = [...new Set(out.flatMap((l) => l.missingItemIds))];
  const complete = out.every((l) => l.cost !== null);
  const total = complete ? out.reduce((s, l) => s.plus(l.cost!), d(0)) : null;
  return { lines: out, total, missingItemIds };
}

/** Esqueleto (spec 008, US3). */
export function usesItem(
  _lines: readonly RecipeLineData[],
  _itemId: string,
  _graph: Map<string, RecipeNode>,
): boolean {
  return false;
}
