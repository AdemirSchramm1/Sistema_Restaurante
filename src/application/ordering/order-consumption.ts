import type { Deps, Repos } from "../ports";
import { refKey, type ComponentRef } from "@/domain/inventory/recipe";
import { lineConsumption } from "@/domain/ordering/consumption";
import { d, type Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

/**
 * O que um pedido gravado consome de cada item, na medida do item (spec 010, US5). Usa a versão do
 * produto gravada no envio, as retiradas e os adicionais copiados. A baixa automática (005) lança
 * o resultado.
 */
export async function orderConsumption(
  deps: Deps,
  restaurantId: string,
  orderId: string,
): Promise<Result<Map<string, Decimal>>> {
  return deps.tenant(restaurantId, (repos) => consumptionFor(repos, orderId));
}

/** O mesmo cálculo, dentro da transação de quem chama (a baixa da spec 011 roda junto com a mudança de situação). */
export async function consumptionFor(repos: Repos, orderId: string): Promise<Result<Map<string, Decimal>>> {
  const lines = await repos.orderChoices.forOrder(orderId);
  if (!lines) return err("NOT_FOUND");
  const graph = await repos.recipes.subRecipeGraph();
  const refs = new Map<string, ComponentRef>();
  const add = (r: ComponentRef) => refs.set(refKey(r), r);
  lines.forEach((l) => {
    l.versionLines.forEach((v) => add(v.component));
    l.addons.forEach((a) => add(a.component));
  });
  graph.forEach((n) => n.lines.forEach((l) => add(l.component)));
  // Toda linha do pedido tem a versão do produto, e as linhas apontam para itens que existem.
  const found = await repos.recipes.components([...refs.values()]);
  const byKey = new Map(found.map((c) => [refKey(c.ref), c]));
  const items = (id: string) => {
    const c = byKey.get(refKey({ kind: "ITEM", id }))!;
    return { stockUnit: c.unit, averageCost: c.averageCost };
  };

  const total = new Map<string, Decimal>();
  for (const l of lines) {
    // Toda linha converte: item que um produto ou adicional usa não troca de família de medida
    // (docs/produto/estoque/02, spec 018), e os componentes existem (chaves estrangeiras).
    const used = lineConsumption(
      {
        versionLines: l.versionLines,
        removed: l.removals,
        addons: l.addons.map((a) => ({
          line: { component: a.component, quantity: a.quantity, unit: a.unit },
          times: a.times,
        })),
        quantity: l.quantity,
      },
      graph,
      items,
    ) as { ok: true; value: Map<string, Decimal> };
    for (const [id, q] of used.value) total.set(id, (total.get(id) ?? d(0)).plus(q));
  }
  return ok(total);
}
