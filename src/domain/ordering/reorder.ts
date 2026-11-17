import type { ComponentRef } from "../inventory/recipe";

/** Produto do cardápio da equipe como a tela recebe (preços em texto "28.00"). */
export type ReorderMenuProduct = {
  id: string;
  name: string;
  price: string;
  soldOut: boolean;
  addons: { id: string; name: string; price: string; maxTimes: number }[];
  removables: { kind: "ITEM" | "RECIPE"; id: string; label: string }[];
};

/** Linha gravada de um pedido da mesa. */
export type ReorderSource = {
  recipeId: string;
  productName: string;
  quantity: number;
  addons: { addonId: string; times: number }[];
  removals: ComponentRef[];
  kitchenNote: string | null;
};

/** Linha pronta para o carrinho (o formato do carrinho da 009/010 + a observação). */
export type ReorderedLine = {
  productId: string;
  name: string;
  basePrice: string;
  quantity: number;
  addons: { id: string; name: string; price: string; times: number }[];
  removals: { kind: "ITEM" | "RECIPE"; id: string; label: string }[];
  kitchenNote: string | null;
};

/** Todas as escolhas ainda existem? Senão, nenhuma vale. */
const allOrNothing = <T>(xs: (T | null)[]): T[] | null => (xs.includes(null) ? null : (xs as T[]));

/**
 * Pedir de novo (spec 015, R20 e FR-019): as mesmas escolhas, com o preço de hoje. O que não dá
 * mais para pedir fica de fora com o motivo; o envio passa pela conferência de sempre.
 */
export function reorderLines(
  lines: readonly ReorderSource[],
  menu: ReadonlyMap<string, ReorderMenuProduct>,
): { lines: ReorderedLine[]; leftOut: string[] } {
  const out: ReorderedLine[] = [];
  const leftOut: string[] = [];
  for (const l of lines) {
    const p = menu.get(l.recipeId);
    if (!p) {
      leftOut.push(`${l.productName} saiu do cardápio e não entrou.`);
      continue;
    }
    if (p.soldOut) {
      leftOut.push(`${p.name} está esgotado hoje e não entrou.`);
      continue;
    }
    const addons = l.addons.map((a) => {
      const now = p.addons.find((x) => x.id === a.addonId);
      return now && a.times <= now.maxTimes
        ? { id: now.id, name: now.name, price: now.price, times: a.times }
        : null;
    });
    const removals = l.removals.map(
      (r) => p.removables.find((x) => x.kind === r.kind && x.id === r.id) ?? null,
    );
    const keptAddons = allOrNothing(addons);
    const keptRemovals = allOrNothing(removals);
    if (!keptAddons || !keptRemovals) {
      leftOut.push(`${p.name} mudou desde o pedido e não entrou. Lance pelo cardápio.`);
      continue;
    }
    out.push({
      productId: p.id,
      name: p.name,
      basePrice: p.price,
      quantity: l.quantity,
      addons: keptAddons,
      removals: keptRemovals,
      kitchenNote: l.kitchenNote,
    });
  }
  return { lines: out, leftOut };
}
