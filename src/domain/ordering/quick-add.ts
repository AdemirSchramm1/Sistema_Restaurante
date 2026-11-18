/** "+" direto no cartão do cardápio (spec 016, US2-6, R11). */

type QuickProduct = {
  id: string;
  name: string;
  price: string;
  addons: readonly unknown[];
  removables: readonly unknown[];
};

export type QuickAddLine = {
  productId: string;
  name: string;
  basePrice: string;
  quantity: number;
  addons: [];
  removals: [];
};

/** Sem nada para escolher, põe 1 no carrinho; com adicional ou retirada, abre a tela do prato. */
export function quickAdd(p: QuickProduct): { kind: "ADD"; line: QuickAddLine } | { kind: "OPEN" } {
  if (p.addons.length > 0 || p.removables.length > 0) return { kind: "OPEN" };
  return {
    kind: "ADD",
    line: { productId: p.id, name: p.name, basePrice: p.price, quantity: 1, addons: [], removals: [] },
  };
}
