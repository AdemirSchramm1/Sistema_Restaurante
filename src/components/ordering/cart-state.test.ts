import { describe, it, expect } from "vitest";
import { MAX_LINE_QUANTITY } from "@/domain/ordering/order-lines";
import {
  addToCart,
  applyPriceChanges,
  cartTotal,
  choiceKey,
  lineChanges,
  removeUnavailable,
  setQuantity,
  toOrderLines,
  type CartLine,
  type CartLineData,
} from "./cart-state";

const cheese = { id: "q", name: "Fatia de queijo", price: "3.00", times: 2 };
const bacon = { id: "b", name: "Bacon", price: "4.50", times: 1 };
const noOnion = { kind: "ITEM" as const, id: "c", label: "Sem cebola" };
const burger: CartLineData = {
  productId: "x",
  name: "X-Burger",
  basePrice: "28.00",
  quantity: 1,
  addons: [cheese],
  removals: [noOnion],
};
const juice: CartLineData = {
  productId: "s",
  name: "Suco",
  basePrice: "9.00",
  quantity: 2,
  addons: [],
  removals: [],
};
const cart = (...lines: CartLineData[]) => lines.reduce<CartLine[]>((c, l) => addToCart(c, l), []);

describe("linhas do carrinho (spec 009 US2, spec 010 US3)", () => {
  it("a ordem das escolhas não muda a linha; escolhas diferentes ficam separadas", () => {
    expect(choiceKey({ ...burger, addons: [cheese, bacon] })).toBe(
      choiceKey({ ...burger, addons: [bacon, cheese] }),
    );
    const lines = cart(burger, { ...burger, quantity: 2 }, { ...burger, removals: [] });
    expect(lines.map((l) => l.quantity)).toEqual([3, 1]);
  });

  it("a quantidade para no máximo da linha; zero tira a linha", () => {
    const [line] = cart({ ...burger, quantity: MAX_LINE_QUANTITY - 1 }, { ...burger, quantity: 5 });
    expect(line!.quantity).toBe(MAX_LINE_QUANTITY);
    const lines = cart(burger, juice);
    expect(setQuantity(lines, lines[1]!.key, 999)[1]!.quantity).toBe(MAX_LINE_QUANTITY);
    expect(setQuantity(lines, lines[1]!.key, 0).map((l) => l.name)).toEqual(["X-Burger"]);
  });

  it("preço da linha com adicionais e total do carrinho, em decimal exato", () => {
    // (28 + 2 × 3) × 1 + 9 × 2
    expect(cartTotal(cart(burger, juice)).toFixed(2)).toBe("52.00");
    expect(cartTotal([]).toFixed(2)).toBe("0.00");
  });

  it("escolhas no texto da cozinha, sem 'SEM sem'", () => {
    expect(
      lineChanges({ ...burger, removals: [noOnion, { kind: "RECIPE", id: "m", label: "maionese" }] }),
    ).toEqual(["+ 2 Fatia de queijo", "SEM cebola", "SEM maionese"]);
  });

  it("o que vai para o servidor leva preços com 2 casas", () => {
    expect(toOrderLines([{ ...burger, quantity: 2 }])).toEqual([
      {
        recipeId: "x",
        quantity: 2,
        unitPrice: "34.00",
        addons: [{ addonId: "q", times: 2, unitPrice: "3.00" }],
        removals: [{ kind: "ITEM", id: "c" }],
      },
    ]);
  });
});

describe("respostas do servidor no carrinho", () => {
  it("preço novo do prato e do adicional: aplica e avisa uma vez cada", () => {
    const lines = cart(burger, { ...burger, removals: [] }, juice);
    const r = applyPriceChanges(lines, {
      prices: [{ recipeId: "x", price: "30.00" }],
      addonPrices: [{ addonId: "q", price: "3.50" }],
    });
    expect(r.messages).toEqual([
      "O preço de X-Burger mudou para R$ 30,00.",
      "O preço de Fatia de queijo mudou para R$ 3,50.",
    ]);
    expect(r.lines.map((l) => [l.basePrice, l.addons[0]?.price])).toEqual([
      ["30.00", "3.50"],
      ["30.00", "3.50"],
      ["9.00", undefined],
    ]);
  });

  it("sem preço novo, nada muda", () => {
    const lines = cart(burger);
    expect(applyPriceChanges(lines, {})).toEqual({ lines, messages: [] });
  });

  it("prato fora do cardápio ou adicional esgotado: tira a linha e diz o quê", () => {
    const lines = cart(burger, { ...burger, addons: [bacon] }, juice);
    expect(removeUnavailable(lines, "PRODUCT_UNAVAILABLE", { recipeIds: ["s"] })).toEqual({
      lines: lines.slice(0, 2),
      messages: ["Suco não está mais disponível."],
    });
    const r = removeUnavailable(lines, "PRODUCT_UNAVAILABLE", { addonIds: ["b"] });
    expect(r.lines.map((l) => l.addons.map((a) => a.id))).toEqual([["q"], []]);
    expect(r.messages).toEqual(["Bacon não está mais disponível."]);
  });

  it("opção de tirar que deixou de existir: só sai a linha daquele prato que a usa", () => {
    const lines = cart(burger, { ...burger, removals: [] }, juice);
    const r = removeUnavailable(lines, "OPTION_UNAVAILABLE", {
      recipeId: "x",
      removals: [{ kind: "ITEM", id: "c" }],
    });
    expect(r.lines.map((l) => [l.name, l.removals.length])).toEqual([
      ["X-Burger", 0],
      ["Suco", 0],
    ]);
    expect(r.messages).toEqual(['"Sem cebola" não está mais disponível para X-Burger.']);
  });
});
