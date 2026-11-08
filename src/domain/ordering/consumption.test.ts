import { describe, it, expect } from "vitest";
import { lineConsumption } from "./consumption";
import type { ItemCostInfo, RecipeNode } from "../inventory/recipe-graph";
import { dishData, itemLine, prepData, prepLine } from "../../../tests/builders/recipe-data";

const ITEMS: Record<string, ItemCostInfo> = {
  pao: { stockUnit: "un", averageCost: null },
  carne: { stockUnit: "kg", averageCost: null },
  queijo: { stockUnit: "kg", averageCost: null },
  cebola: { stockUnit: "kg", averageCost: null },
  tomate: { stockUnit: "kg", averageCost: null },
};
const items = (id: string) => ITEMS[id];
const MOLHO: RecipeNode = { id: "molho", ...prepData() };
const graph = new Map([[MOLHO.id, MOLHO]]);
const map = (m: Map<string, unknown>) => Object.fromEntries([...m].map(([k, v]) => [k, String(v)]));

/** X-Burger com cebola: pão 1 un, carne 150 g, queijo 30 g, cebola 20 g. */
const XBURGER = [...dishData().lines, itemLine("cebola", "20", "g")];

describe("consumo da linha do pedido (spec 010, US5, FR-009)", () => {
  it("exemplo da spec: 2 X-Burger, + 2 Fatia de queijo (20 g), sem cebola", () => {
    const r = lineConsumption(
      {
        versionLines: XBURGER,
        removed: [{ kind: "ITEM", id: "cebola" }],
        addons: [{ line: itemLine("queijo", "20", "g"), times: 2 }],
        quantity: 2,
      },
      graph,
      items,
    );
    expect(r.ok && map(r.value)).toEqual({ pao: "2", carne: "0.3", queijo: "0.14" });
  });

  it("sem escolhas é o produto explodido × quantidade", () => {
    const r = lineConsumption({ versionLines: XBURGER, removed: [], addons: [], quantity: 3 }, graph, items);
    expect(r.ok && map(r.value)).toEqual({ pao: "3", carne: "0.45", queijo: "0.09", cebola: "0.06" });
  });

  it('tirar um preparo tira o preparo inteiro ("Sem molho")', () => {
    const lines = [itemLine("pao", "1", "un"), prepLine("molho", "50", "g")];
    const r = lineConsumption(
      { versionLines: lines, removed: [{ kind: "RECIPE", id: "molho" }], addons: [], quantity: 1 },
      graph,
      items,
    );
    expect(r.ok && map(r.value)).toEqual({ pao: "1" });
  });

  it("adicional de preparo desce até os ingredientes", () => {
    const r = lineConsumption(
      {
        versionLines: [itemLine("pao", "1", "un")],
        removed: [],
        addons: [{ line: prepLine("molho", "50", "g"), times: 1 }],
        quantity: 1,
      },
      graph,
      items,
    );
    expect(r.ok && map(r.value)).toEqual({ pao: "1", tomate: "0.0625", cebola: "0.005" });
  });

  it("propaga erro de item desconhecido", () => {
    const r = lineConsumption(
      { versionLines: [itemLine("nada", "1", "un")], removed: [], addons: [], quantity: 1 },
      graph,
      items,
    );
    expect(r.ok).toBe(false);
  });
});
