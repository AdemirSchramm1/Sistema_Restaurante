import { d, formatBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { MAX_LINE_QUANTITY } from "@/domain/ordering/order-lines";

/** Carrinho do celular (spec 009 US2, spec 010 US3). Preços chegam do servidor como "28.00". */

export type CartAddon = { id: string; name: string; price: string; times: number };
export type CartRemoval = { kind: "ITEM" | "RECIPE"; id: string; label: string };
export type CartLineData = {
  productId: string;
  name: string;
  basePrice: string;
  quantity: number;
  addons: CartAddon[];
  removals: CartRemoval[];
};
export type CartLine = CartLineData & { key: string };

/** Mesmas escolhas = mesma linha; escolhas diferentes ficam em linhas separadas (FR-006). */
export const choiceKey = (l: Omit<CartLineData, "quantity" | "name" | "basePrice">) =>
  [
    l.productId,
    ...l.addons
      .map((a) => `${a.id}x${a.times}`)
      .sort(),
    "|",
    ...l.removals.map((r) => `${r.kind}:${r.id}`).sort(),
  ].join(",");

export const unitPrice = (l: CartLineData): Decimal =>
  l.addons.reduce((s, a) => s.plus(d(a.price).times(a.times)), d(l.basePrice));

export const lineTotal = (l: CartLineData): Decimal => unitPrice(l).times(l.quantity);

export const cartTotal = (lines: readonly CartLineData[]): Decimal =>
  lines.reduce((s, l) => s.plus(lineTotal(l)), d(0));

export const brl = (v: Decimal | string) =>
  `R$ ${formatBrDecimal(typeof v === "string" ? d(v) : v, { minPlaces: 2, maxPlaces: 2 })}`;

export const priceOrFree = (v: string) => (d(v).isZero() ? "Grátis" : brl(v));

/** Texto das escolhas como a cozinha vê: "+ 2 Fatia de queijo", "SEM cebola". */
export const lineChanges = (l: CartLineData) => [
  ...l.addons.map((a) => `+ ${a.times} ${a.name}`),
  ...l.removals.map((r) => `SEM ${r.label.trim().replace(/^sem\s+/i, "")}`),
];

export function addToCart(lines: readonly CartLine[], data: CartLineData): CartLine[] {
  const key = choiceKey(data);
  const same = lines.find((l) => l.key === key);
  if (!same) return [...lines, { ...data, key }];
  return lines.map((l) =>
    l.key === key ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, l.quantity + data.quantity) } : l,
  );
}

export const setQuantity = (lines: readonly CartLine[], key: string, quantity: number): CartLine[] =>
  quantity < 1
    ? lines.filter((l) => l.key !== key)
    : lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, quantity) } : l));

/** O que vai para `submitOrderAction`. */
export const toOrderLines = (lines: readonly CartLineData[]) =>
  lines.map((l) => ({
    recipeId: l.productId,
    quantity: l.quantity,
    unitPrice: unitPrice(l).toFixed(2),
    addons: l.addons.map((a) => ({ addonId: a.id, times: a.times, unitPrice: d(a.price).toFixed(2) })),
    removals: l.removals.map((r) => ({ kind: r.kind, id: r.id })),
  }));

export type PriceChanges = {
  prices?: { recipeId: string; price: string }[];
  addonPrices?: { addonId: string; price: string }[];
};

/** Aplica os preços novos que o servidor devolveu e diz o que mudou, em português. */
export function applyPriceChanges(lines: readonly CartLine[], ch: PriceChanges): { lines: CartLine[]; messages: string[] } {
  const prices = new Map((ch.prices ?? []).map((p) => [p.recipeId, p.price]));
  const addonPrices = new Map((ch.addonPrices ?? []).map((p) => [p.addonId, p.price]));
  const messages = new Set<string>();
  const next = lines.map((l) => {
    const base = prices.get(l.productId);
    if (base) messages.add(`O preço de ${l.name} mudou para ${brl(base)}.`);
    return {
      ...l,
      basePrice: base ?? l.basePrice,
      addons: l.addons.map((a) => {
        const p = addonPrices.get(a.id);
        if (p) messages.add(`O preço de ${a.name} mudou para ${brl(p)}.`);
        return p ? { ...a, price: p } : a;
      }),
    };
  });
  return { lines: next, messages: [...messages] };
}

export type Unavailable = {
  recipeIds?: string[];
  addonIds?: string[];
  recipeId?: string;
  removals?: { kind: string; id: string }[];
};

/** Tira do carrinho o que não está mais disponível e diz o quê. */
export function removeUnavailable(
  lines: readonly CartLine[],
  code: string,
  u: Unavailable,
): { lines: CartLine[]; messages: string[] } {
  const recipes = new Set(u.recipeIds ?? []);
  const addons = new Set(u.addonIds ?? []);
  const messages = new Set<string>();
  const kept = lines.filter((l) => {
    if (recipes.has(l.productId)) {
      messages.add(`${l.name} não está mais disponível.`);
      return false;
    }
    const gone = l.addons.filter((a) => addons.has(a.id));
    gone.forEach((a) => messages.add(`${a.name} não está mais disponível.`));
    if (code === "OPTION_UNAVAILABLE" && l.productId === u.recipeId) {
      const ids = new Set((u.removals ?? []).map((r) => `${r.kind}:${r.id}`));
      const removed = l.removals.filter((r) => ids.has(`${r.kind}:${r.id}`));
      removed.forEach((r) => messages.add(`"${r.label}" não está mais disponível para ${l.name}.`));
      return removed.length === 0;
    }
    return gone.length === 0;
  });
  return { lines: kept, messages: [...messages] };
}
