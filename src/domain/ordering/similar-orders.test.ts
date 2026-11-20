import { describe, expect, it } from "vitest";
import { SIMILAR_WINDOW_MINUTES, similarRecentOrders, similarText, type RecentOrder } from "./similar-orders";

const NOW = new Date("2026-11-17T20:10:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const order = (over: Partial<RecentOrder> = {}): RecentOrder => ({
  submittedAt: ago(1),
  source: "STAFF",
  placedById: "maria",
  placedByName: "Maria",
  status: "RECEIVED",
  lines: [{ recipeId: "chope", productName: "Chope", quantity: 2 }],
  ...over,
});
const find = (orders: RecentOrder[], cart = ["chope"]) =>
  similarRecentOrders({ orders, cartRecipeIds: cart, userId: "joao", now: NOW });

describe("aviso de pedido parecido (spec 015, US6-3, FR-020)", () => {
  it("outra pessoa lançou o mesmo produto há 1 min", () => {
    expect(SIMILAR_WINDOW_MINUTES).toBe(5);
    const w = find([order()]);
    expect(w).toEqual([{ who: "Maria", items: "2 Chope", minutes: 1 }]);
    expect(similarText(w[0]!)).toBe("Maria lançou 2 Chope nesta mesa há 1 min.");
  });

  it("pelo QR code também avisa; vários produtos do carrinho no mesmo pedido", () => {
    const w = find(
      [
        order({
          source: "QR",
          placedById: null,
          placedByName: null,
          submittedAt: ago(0.2),
          lines: [
            { recipeId: "chope", productName: "Chope", quantity: 2 },
            { recipeId: "burger", productName: "X-Burger", quantity: 1 },
            { recipeId: "suco", productName: "Suco", quantity: 1 },
          ],
        }),
      ],
      ["chope", "burger"],
    );
    expect(w).toEqual([{ who: "QR code", items: "2 Chope e 1 X-Burger", minutes: 0 }]);
    expect(similarText(w[0]!)).toBe("Pelo QR code pediram 2 Chope e 1 X-Burger nesta mesa agora há pouco.");
  });

  it("não avisa os próprios, os cancelados, os de mais de 5 min nem outro produto", () => {
    expect(find([order({ placedById: "joao", placedByName: "João" })])).toEqual([]);
    expect(find([order({ status: "CANCELLED" })])).toEqual([]);
    expect(find([order({ submittedAt: ago(5.1) })])).toEqual([]);
    expect(find([order()], ["burger"])).toEqual([]);
    expect(find([order({ submittedAt: ago(5) })])).toHaveLength(1);
  });

  it("quem lançou sem nome (usuário apagado) aparece como alguém da equipe", () => {
    const w = find([order({ placedByName: null, submittedAt: ago(3) })]);
    expect(similarText(w[0]!)).toBe("Alguém da equipe lançou 2 Chope nesta mesa há 3 min.");
  });

  it("três produtos viram lista com vírgula", () => {
    const w = find(
      [
        order({
          lines: [
            { recipeId: "a", productName: "A", quantity: 1 },
            { recipeId: "b", productName: "B", quantity: 2 },
            { recipeId: "c", productName: "C", quantity: 3 },
          ],
        }),
      ],
      ["a", "b", "c"],
    );
    expect(w[0]!.items).toBe("1 A, 2 B e 3 C");
  });
});
