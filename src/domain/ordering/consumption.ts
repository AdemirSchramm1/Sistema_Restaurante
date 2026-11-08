import { d, type Decimal } from "../shared/decimal";
import { ok, type Result } from "../shared/result";
import { refKey, type ComponentRef, type RecipeLineData } from "../inventory/recipe";
import { explode, type ItemCostInfo, type RecipeNode } from "../inventory/recipe-graph";

export type LineConsumptionInput = {
  /** Linhas da versão do produto gravada no pedido. */
  versionLines: readonly RecipeLineData[];
  removed: readonly ComponentRef[];
  addons: readonly { line: RecipeLineData; times: number }[];
  quantity: number;
};

/**
 * O que uma linha do pedido consome de cada item, na medida do item (spec 010, US5, research R6):
 * (produto − retiradas + adicionais × vezes) × quantidade. A baixa (005) lança isso.
 */
export function lineConsumption(
  input: LineConsumptionInput,
  graph: Map<string, RecipeNode>,
  items: (id: string) => ItemCostInfo | undefined,
): Result<Map<string, Decimal>> {
  const removed = new Set(input.removed.map(refKey));
  const qty = d(input.quantity);
  const kept = input.versionLines.filter((l) => !removed.has(refKey(l.component)));
  const out = new Map<string, Decimal>();
  const addAll = (m: Map<string, Decimal>) => {
    for (const [id, q] of m) out.set(id, (out.get(id) ?? d(0)).plus(q));
  };
  const base = explode(kept, qty, graph, items);
  if (!base.ok) return base;
  addAll(base.value);
  for (const a of input.addons) {
    const extra = explode([a.line], qty.times(a.times), graph, items);
    if (!extra.ok) return extra;
    addAll(extra.value);
  }
  return ok(out);
}
