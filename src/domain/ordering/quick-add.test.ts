import { describe, it, expect } from "vitest";
import { quickAdd } from "./quick-add";

const product = (over: Partial<Parameters<typeof quickAdd>[0]> = {}) => ({
  id: "suco",
  name: "Suco",
  price: "9.00",
  addons: [],
  removables: [],
  ...over,
});

describe('"+" direto no cartão (spec 016, US2-6, R11)', () => {
  it("sem adicionais nem retiradas vai para o carrinho com 1, sem escolhas", () => {
    expect(quickAdd(product())).toEqual({
      kind: "ADD",
      line: { productId: "suco", name: "Suco", basePrice: "9.00", quantity: 1, addons: [], removals: [] },
    });
  });

  it("com adicional ou com retirada abre a tela do prato", () => {
    expect(quickAdd(product({ addons: [{ id: "q", name: "Queijo", price: "3.00", maxTimes: 2 }] }))).toEqual({
      kind: "OPEN",
    });
    expect(quickAdd(product({ removables: [{ kind: "ITEM", id: "c", label: "Cebola" }] }))).toEqual({
      kind: "OPEN",
    });
  });
});
