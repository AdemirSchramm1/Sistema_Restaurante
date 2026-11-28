import { describe, it, expect } from "vitest";
import { checkOrder, type CatalogProduct, type RequestedLine } from "./checkout";
import { d } from "../shared/decimal";

const xBurger: CatalogProduct = {
  id: "x",
  name: "X-Burger",
  versionId: "x-v2",
  salePrice: d("28.00"),
  available: true,
  options: {
    addons: [{ addonId: "queijo", name: "Fatia de queijo", price: d("3.00"), maxTimes: 3, available: true }],
    removables: [{ component: { kind: "ITEM", id: "cebola" }, label: "Sem cebola", available: true }],
  },
};
const suco: CatalogProduct = {
  id: "s",
  name: "Suco",
  versionId: "s-v1",
  salePrice: d("9.00"),
  available: true,
  options: { addons: [], removables: [] },
};
const catalog = (...p: CatalogProduct[]) => new Map(p.map((x) => [x.id, x]));

const line = (over: Partial<RequestedLine> = {}): RequestedLine => ({
  recipeId: "x",
  quantity: 2,
  unitPrice: d("34.00"),
  addons: [{ addonId: "queijo", times: 2, unitPrice: d("3.00") }],
  removals: [{ kind: "ITEM", id: "cebola" }],
  ...over,
});
const sucoLine: RequestedLine = {
  recipeId: "s",
  quantity: 1,
  unitPrice: d("9.00"),
  addons: [],
  removals: [],
};

describe("conferência no envio (spec 009 R9 + spec 010 R5)", () => {
  it("devolve as linhas com versão, preço do produto, preço da linha e cópia das escolhas", () => {
    const r = checkOrder([line(), sucoLine], catalog(xBurger, suco));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [a, b] = r.value;
    expect(a).toMatchObject({ recipeId: "x", versionId: "x-v2", quantity: 2 });
    expect(a!.basePrice.toFixed(2)).toBe("28.00");
    expect(a!.unitPrice.toFixed(2)).toBe("34.00");
    expect(a!.addons).toEqual([
      { addonId: "queijo", name: "Fatia de queijo", times: 2, unitPrice: d("3.00") },
    ]);
    expect(a!.removals).toEqual([{ component: { kind: "ITEM", id: "cebola" }, label: "Sem cebola" }]);
    expect(b!.unitPrice.toFixed(2)).toBe("9.00");
  });

  it("pedido vazio, linhas demais e quantidade inválida", () => {
    expect(checkOrder([], catalog(xBurger)).ok).toBe(false);
    const q = checkOrder([line({ quantity: 21 })], catalog(xBurger));
    expect(!q.ok && q.error.code).toBe("INVALID_QUANTITY");
  });

  it("produto que saiu do cardápio (esgotado, inativo, sem preço) → PRODUCT_UNAVAILABLE com a lista (US2-11)", () => {
    const r = checkOrder([line(), sucoLine], catalog({ ...xBurger, available: false }, suco));
    expect(r).toEqual({
      ok: false,
      error: { code: "PRODUCT_UNAVAILABLE", details: { recipeIds: ["x"], addonIds: [] } },
    });
    const gone = checkOrder([sucoLine], catalog(xBurger));
    expect(!gone.ok && gone.error.details).toEqual({ recipeIds: ["s"], addonIds: [] });
  });

  it("adicional indisponível entra na mesma lista", () => {
    const off = {
      ...xBurger,
      options: { ...xBurger.options, addons: [{ ...xBurger.options.addons[0]!, available: false }] },
    };
    const r = checkOrder([line()], catalog(off));
    expect(!r.ok && r.error).toEqual({
      code: "PRODUCT_UNAVAILABLE",
      details: { recipeIds: [], addonIds: ["queijo"] },
    });
  });

  it("retirada que sumiu → OPTION_UNAVAILABLE", () => {
    const off = { ...xBurger, options: { ...xBurger.options, removables: [] } };
    const r = checkOrder([line()], catalog(off));
    expect(!r.ok && r.error.code).toBe("OPTION_UNAVAILABLE");
  });

  it("preço do produto mudou → PRICE_CHANGED com os preços novos; nada é aceito (US2-10)", () => {
    const r = checkOrder([line(), sucoLine], catalog(xBurger, { ...suco, salePrice: d("10.00") }));
    expect(!r.ok && r.error.code).toBe("PRICE_CHANGED");
    if (!r.ok) {
      expect(r.error.details).toEqual({ prices: [{ recipeId: "s", price: "10.00" }], addonPrices: [] });
    }
  });

  it("preço do adicional mudou → PRICE_CHANGED com o adicional (spec 010, US3-8)", () => {
    const up = {
      ...xBurger,
      options: { ...xBurger.options, addons: [{ ...xBurger.options.addons[0]!, price: d("3.50") }] },
    };
    const r = checkOrder([line()], catalog(up));
    expect(!r.ok && r.error.details).toEqual({
      prices: [],
      addonPrices: [{ addonId: "queijo", price: "3.50" }],
    });
  });

  it("preço da linha diferente da soma também é recusado", () => {
    const r = checkOrder([line({ unitPrice: d("30.00") })], catalog(xBurger));
    expect(!r.ok && r.error.code).toBe("PRICE_CHANGED");
  });

  it("o mesmo produto pode vir em duas linhas com escolhas diferentes", () => {
    const plain = line({ quantity: 1, unitPrice: d("28.00"), addons: [], removals: [] });
    expect(checkOrder([line(), plain], catalog(xBurger)).ok).toBe(true);
  });
});

describe("observação para a cozinha na conferência (spec 015, FR-018)", () => {
  it("passa para a linha conferida sem mudar o preço", () => {
    const r = checkOrder(
      [line({ kitchenNote: "mal passado" }), line({ kitchenNote: "ao ponto" }), sucoLine],
      catalog(xBurger, suco),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((l) => l.kitchenNote)).toEqual(["mal passado", "ao ponto", null]);
    expect(r.value.map((l) => l.unitPrice.toFixed(2))).toEqual(["34.00", "34.00", "9.00"]);
  });
});

describe("campos das recusas do envio (spec 018, R4)", () => {
  it("quantidade inválida aponta a linha certa", () => {
    const r = checkOrder([sucoLine, line({ quantity: 0 })], catalog(xBurger, suco));
    expect(r.ok ? null : [r.error.code, r.error.field]).toEqual(["INVALID_QUANTITY", "lines.1.quantity"]);
  });

  it("adicional que o produto não oferece entra na lista de indisponíveis", () => {
    const r = checkOrder(
      [line({ addons: [{ addonId: "bacon", times: 1, unitPrice: d("4.00") }] })],
      catalog(xBurger),
    );
    expect(r.ok ? null : r.error).toMatchObject({
      code: "PRODUCT_UNAVAILABLE",
      details: { recipeIds: [], addonIds: ["bacon"] },
    });
  });

  it("escolha recusada aponta a linha e diz o produto", () => {
    const r = checkOrder(
      [sucoLine, line({ removals: [{ kind: "ITEM", id: "tomate" }] })],
      catalog(xBurger, suco),
    );
    expect(r.ok ? null : r.error).toMatchObject({
      code: "OPTION_UNAVAILABLE",
      field: "lines.1",
      details: { recipeId: "x", removals: [{ kind: "ITEM", id: "tomate" }] },
    });
  });
});
