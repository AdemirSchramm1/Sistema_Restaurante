import { describe, expect, it } from "vitest";
import { reorderLines, type ReorderMenuProduct } from "./reorder";

const burger: ReorderMenuProduct = {
  id: "burger",
  name: "X-Burger",
  price: "30.00",
  soldOut: false,
  addons: [
    { id: "queijo", name: "Fatia de queijo", price: "2.50", maxTimes: 2 },
    { id: "bacon", name: "Bacon", price: "4.00", maxTimes: 1 },
  ],
  removables: [{ kind: "ITEM", id: "cebola", label: "Sem cebola" }],
};
const chope: ReorderMenuProduct = {
  id: "chope",
  name: "Chope",
  price: "12.00",
  soldOut: false,
  addons: [],
  removables: [],
};
const pure: ReorderMenuProduct = {
  id: "pure",
  name: "Purê",
  price: "15.00",
  soldOut: true,
  addons: [],
  removables: [],
};
const menu = new Map([burger, chope, pure].map((p) => [p.id, p]));

const burgerLine = {
  recipeId: "burger",
  productName: "X-Burger",
  quantity: 1,
  addons: [{ addonId: "queijo", times: 2 }],
  removals: [{ kind: "ITEM" as const, id: "cebola" }],
  kitchenNote: "mal passado",
};
const chopeLine = {
  recipeId: "chope",
  productName: "Chope",
  quantity: 2,
  addons: [],
  removals: [],
  kitchenNote: null,
};

describe("Pedir de novo (spec 015, US6-1, US6-2, FR-019)", () => {
  it("mesmas escolhas com o preço de hoje", () => {
    const r = reorderLines([chopeLine, burgerLine], menu);
    expect(r.leftOut).toEqual([]);
    expect(r.lines).toEqual([
      {
        productId: "chope",
        name: "Chope",
        basePrice: "12.00",
        quantity: 2,
        addons: [],
        removals: [],
        kitchenNote: null,
      },
      {
        productId: "burger",
        name: "X-Burger",
        basePrice: "30.00",
        quantity: 1,
        addons: [{ id: "queijo", name: "Fatia de queijo", price: "2.50", times: 2 }],
        removals: [{ kind: "ITEM", id: "cebola", label: "Sem cebola" }],
        kitchenNote: "mal passado",
      },
    ]);
  });

  it("esgotado ou fora do cardápio não entra e a tela diz o porquê", () => {
    const r = reorderLines(
      [
        { ...chopeLine, recipeId: "pure", productName: "Purê" },
        { ...chopeLine, recipeId: "suco", productName: "Suco" },
        chopeLine,
      ],
      menu,
    );
    expect(r.lines.map((l) => l.productId)).toEqual(["chope"]);
    expect(r.leftOut).toEqual([
      "Purê está esgotado hoje e não entrou.",
      "Suco saiu do cardápio e não entrou.",
    ]);
  });

  it("adicional ou retirada que saiu tira a linha; vezes acima do máximo de hoje também", () => {
    const r = reorderLines(
      [
        { ...burgerLine, addons: [{ addonId: "ovo", times: 1 }] },
        { ...burgerLine, removals: [{ kind: "ITEM", id: "tomate" }] },
        { ...burgerLine, removals: [{ kind: "RECIPE", id: "cebola" }] },
        { ...burgerLine, addons: [{ addonId: "bacon", times: 2 }] },
      ],
      menu,
    );
    expect(r.lines).toEqual([]);
    expect(r.leftOut).toEqual([
      "X-Burger mudou desde o pedido e não entrou. Lance pelo cardápio.",
      "X-Burger mudou desde o pedido e não entrou. Lance pelo cardápio.",
      "X-Burger mudou desde o pedido e não entrou. Lance pelo cardápio.",
      "X-Burger mudou desde o pedido e não entrou. Lance pelo cardápio.",
    ]);
  });
});
