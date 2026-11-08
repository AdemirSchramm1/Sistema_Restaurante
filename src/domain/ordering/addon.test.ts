import { describe, it, expect } from "vitest";
import { validateAddon, validateAddonPrice, type AddonData } from "./addon";
import type { ComponentInfo, ComponentRef } from "../inventory/recipe";
import { d } from "../shared/decimal";

const INFO: Record<string, ComponentInfo> = {
  "ITEM:queijo": {
    ref: { kind: "ITEM", id: "queijo" },
    name: "Queijo mussarela",
    active: true,
    unit: "kg",
    isSubRecipe: false,
  },
  "ITEM:velho": {
    ref: { kind: "ITEM", id: "velho" },
    name: "Velho",
    active: false,
    unit: "kg",
    isSubRecipe: false,
  },
  "RECIPE:molho": {
    ref: { kind: "RECIPE", id: "molho" },
    name: "Molho da casa",
    active: true,
    unit: "kg",
    isSubRecipe: true,
  },
  "RECIPE:xburger": {
    ref: { kind: "RECIPE", id: "xburger" },
    name: "X-Burger",
    active: true,
    unit: "un",
    isSubRecipe: false,
  },
};
const lookup = (r: ComponentRef) => INFO[`${r.kind}:${r.id}`];

const fatia = (over: Partial<AddonData> = {}): AddonData => ({
  name: "Fatia de queijo",
  component: { kind: "ITEM", id: "queijo" },
  quantity: d("20"),
  unit: "g",
  price: d("3.00"),
  ...over,
});
const code = (r: { ok: boolean; error?: { code: string; field?: string } }) => (r.ok ? null : r.error!.code);

describe("adicional (spec 010, US1, FR-001)", () => {
  it('"Fatia de queijo": 20 g de queijo mussarela por R$ 3,00', () => {
    expect(validateAddon(fatia(), lookup)).toEqual({
      ok: true,
      value: { name: "Fatia de queijo", normalized: "fatia de queijo" },
    });
  });

  it("nome de 1 a 40 caracteres", () => {
    expect(code(validateAddon(fatia({ name: "  " }), lookup))).toBe("INVALID_NAME");
    expect(code(validateAddon(fatia({ name: "a".repeat(41) }), lookup))).toBe("INVALID_NAME");
    expect(validateAddon(fatia({ name: "a".repeat(40) }), lookup).ok).toBe(true);
  });

  it("pode usar um preparo (US1-4), mas não um produto vendido", () => {
    expect(
      validateAddon(fatia({ component: { kind: "RECIPE", id: "molho" }, quantity: d("30") }), lookup).ok,
    ).toBe(true);
    expect(
      code(validateAddon(fatia({ component: { kind: "RECIPE", id: "xburger" }, unit: "un" }), lookup)),
    ).toBe("NOT_A_SUB_RECIPE");
  });

  it("item ou preparo ativo e existente", () => {
    expect(code(validateAddon(fatia({ component: { kind: "ITEM", id: "velho" } }), lookup))).toBe(
      "COMPONENT_INACTIVE",
    );
    expect(code(validateAddon(fatia({ component: { kind: "ITEM", id: "nada" } }), lookup))).toBe("NOT_FOUND");
  });

  it("medida da mesma família da do item (US1-3)", () => {
    expect(validateAddon(fatia({ quantity: d("0.02"), unit: "kg" }), lookup).ok).toBe(true);
    expect(code(validateAddon(fatia({ unit: "un" }), lookup))).toBe("UNIT_DIMENSION_MISMATCH");
  });

  it("quantidade maior que zero com até 4 casas", () => {
    expect(code(validateAddon(fatia({ quantity: d("0") }), lookup))).toBe("INVALID_QUANTITY");
    expect(code(validateAddon(fatia({ quantity: d("0.00001") }), lookup))).toBe("INVALID_QUANTITY");
    expect(validateAddon(fatia({ quantity: d("0.0001") }), lookup).ok).toBe(true);
  });
});

describe("preço do adicional (spec 010, US1-5)", () => {
  it("zero é permitido (Grátis); negativo e 3 casas não", () => {
    expect(validateAddonPrice(d("0")).ok).toBe(true);
    expect(validateAddonPrice(d("3.5")).ok).toBe(true);
    expect(code(validateAddonPrice(d("-1")))).toBe("INVALID_PRICE");
    expect(code(validateAddonPrice(d("3.005")))).toBe("INVALID_PRICE");
  });
});
