import type { OrderSource, OrderStatus } from "./order";

/** Janela do aviso de pedido parecido (spec 015, R21). */
export const SIMILAR_WINDOW_MINUTES = 5;

/** Pedido da mesa como a tela do garçom recebe. */
export type RecentOrder = {
  submittedAt: string;
  source: OrderSource;
  placedById: string | null;
  placedByName: string | null;
  status: OrderStatus;
  lines: { recipeId: string; productName: string; quantity: number }[];
};

export type SimilarOrder = { who: string; items: string; minutes: number };

/** "1 A", "1 A e 2 B", "1 A, 2 B e 3 C". */
const list = (parts: string[]) =>
  parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}` : parts[0]!;

/**
 * Pedidos de outra pessoa ou do QR code, nos últimos 5 minutos, com algum produto que está no
 * carrinho (FR-020). Os próprios e os cancelados não avisam. Não bloqueia: só pede uma confirmação.
 */
export function similarRecentOrders(input: {
  orders: readonly RecentOrder[];
  cartRecipeIds: readonly string[];
  userId: string;
  now: Date;
}): SimilarOrder[] {
  const cart = new Set(input.cartRecipeIds);
  return input.orders.flatMap((o) => {
    const age = (input.now.getTime() - Date.parse(o.submittedAt)) / 60_000;
    if (age > SIMILAR_WINDOW_MINUTES || o.status === "CANCELLED") return [];
    if (o.placedById === input.userId) return [];
    const same = o.lines.filter((l) => cart.has(l.recipeId));
    if (!same.length) return [];
    return [
      {
        who: o.source === "QR" ? "QR code" : (o.placedByName ?? "Alguém da equipe"),
        items: list(same.map((l) => `${l.quantity} ${l.productName}`)),
        minutes: Math.floor(age),
      },
    ];
  });
}

/** "Maria lançou 2 Chope nesta mesa há 1 min." */
export function similarText(w: SimilarOrder): string {
  const when = w.minutes < 1 ? "agora há pouco" : `há ${w.minutes} min`;
  return w.who === "QR code"
    ? `Pelo QR code pediram ${w.items} nesta mesa ${when}.`
    : `${w.who} lançou ${w.items} nesta mesa ${when}.`;
}
