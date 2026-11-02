import { describe, it, expect } from "vitest";
import { explode, findCycle, recipeCost, usesItem, type RecipeNode, type ItemCostInfo } from "./recipe-graph";
import { d } from "../shared/decimal";
import { dishData, itemLine, prepData, prepLine } from "../../../tests/builders/recipe-data";

const ITEMS: Record<string, ItemCostInfo> = {
  pao: { stockUnit: "un", averageCost: d("1.20") },
  carne: { stockUnit: "kg", averageCost: d("40") },
  queijo: { stockUnit: "kg", averageCost: d("50") },
  tomate: { stockUnit: "kg", averageCost: d("8") },
  cebola: { stockUnit: "kg", averageCost: d("5") },
  semcusto: { stockUnit: "kg", averageCost: null },
};
const items = (id: string) => ITEMS[id];

const node = (id: string, data: ReturnType<typeof prepData>): RecipeNode => ({ id, ...data });
/** Molho rende 2 kg com 2,5 kg de tomate e 200 g de cebola. */
const MOLHO = node("molho", prepData());
const graphOf = (...nodes: RecipeNode[]) => new Map(nodes.map((n) => [n.id, n]));

const map = (m: Map<string, unknown>) => Object.fromEntries([...m].map(([k, v]) => [k, String(v)]));

describe("explodir o produto em itens (FR-009)", () => {
  it("2 X-Burger baixam 2 pães, 0,3 kg de carne e 0,06 kg de queijo", () => {
    const r = explode(dishData().lines, d("2"), graphOf(), items);
    expect(r.ok).toBe(true);
    if (r.ok) expect(map(r.value)).toEqual({ pao: "2", carne: "0.3", queijo: "0.06" });
  });

  it("50 g de molho que rende 2 kg = 1/40 de cada ingrediente do molho", () => {
    const lines = [itemLine("pao", "1", "un"), prepLine("molho", "50", "g")];
    const r = explode(lines, d("1"), graphOf(MOLHO), items);
    expect(r.ok).toBe(true);
    if (r.ok) expect(map(r.value)).toEqual({ pao: "1", tomate: "0.0625", cebola: "0.005" });
  });

  it("soma o mesmo item vindo do produto e do preparo", () => {
    const lines = [itemLine("tomate", "100", "g"), prepLine("molho", "0.5", "kg")];
    const r = explode(lines, d("1"), graphOf(MOLHO), items);
    if (r.ok) expect(map(r.value).tomate).toBe("0.725");
  });

  it("desce por preparo dentro de preparo", () => {
    const base = node(
      "base",
      prepData({
        name: "Base",
        yieldQuantity: d("1"),
        yieldUnit: "l",
        lines: [prepLine("molho", "1", "kg")],
      }),
    );
    const r = explode([prepLine("base", "250", "ml")], d("1"), graphOf(MOLHO, base), items);
    // 250 ml de base = 1/4 l → 0,25 kg de molho → 1/8 do molho
    if (r.ok) expect(map(r.value)).toEqual({ tomate: "0.3125", cebola: "0.025" });
  });

  it("preparo que não está no grafo dá NOT_FOUND", () => {
    const r = explode([prepLine("sumiu", "1", "kg")], d("1"), graphOf(), items);
    expect(r.ok ? "OK" : r.error.code).toBe("NOT_FOUND");
  });
});

describe("ciclos entre preparos (FR-010)", () => {
  it("usar a si mesmo é ciclo", () => {
    expect(findCycle("molho", [prepLine("molho", "1", "kg")], graphOf())).toEqual(["molho", "molho"]);
  });

  it("A usa B que usa A é ciclo", () => {
    const b = node("b", prepData({ name: "B", lines: [prepLine("a", "1", "kg")] }));
    expect(findCycle("a", [prepLine("b", "1", "kg")], graphOf(b))).toEqual(["a", "b", "a"]);
  });

  it("A usa B que usa o molho não é ciclo", () => {
    const b = node("b", prepData({ name: "B", lines: [prepLine("molho", "1", "kg")] }));
    expect(findCycle("a", [prepLine("b", "1", "kg")], graphOf(b, MOLHO))).toBeNull();
  });

  it("produto novo (sem id) nunca fecha ciclo", () => {
    expect(findCycle(null, [prepLine("molho", "1", "kg")], graphOf(MOLHO))).toBeNull();
  });
});

describe("custo do produto (FR-005)", () => {
  it("150 g de carne a R$ 40,00/kg custam R$ 6,00; o X-Burger custa R$ 8,70", () => {
    const c = recipeCost(dishData().lines, graphOf(), items);
    expect(c.lines.map((l) => l.cost?.toString())).toEqual(["1.2", "6", "1.5"]);
    expect(c.total?.toString()).toBe("8.7");
    expect(c.missingItemIds).toEqual([]);
  });

  it("linha de preparo custa a parte proporcional do preparo", () => {
    // Molho inteiro: 2,5 × 8 + 0,2 × 5 = 21 → 50 g = 21 / 40 = 0,525
    const c = recipeCost([prepLine("molho", "50", "g")], graphOf(MOLHO), items);
    expect(c.total?.toString()).toBe("0.525");
  });

  it("sem custo médio em algum item, o total fica sem custo e diz qual falta", () => {
    const c = recipeCost([itemLine("carne", "1", "kg"), itemLine("semcusto", "1", "kg")], graphOf(), items);
    expect(c.lines[0]!.cost?.toString()).toBe("40");
    expect(c.lines[1]!.cost).toBeNull();
    expect(c.lines[1]!.missingItemIds).toEqual(["semcusto"]);
    expect(c.total).toBeNull();
    expect(c.missingItemIds).toEqual(["semcusto"]);
  });
});

describe("produtos em que o item entra (spec 008, US3)", () => {
  it("usa o item direto numa linha", () => {
    expect(usesItem(dishData().lines, "carne", graphOf())).toBe(true);
  });

  it("usa o item dentro de um preparo, em qualquer nível", () => {
    const base = node("base", prepData({ name: "Base", lines: [prepLine("molho", "1", "kg")] }));
    const lines = [itemLine("pao", "1", "un"), prepLine("base", "100", "g")];
    expect(usesItem(lines, "cebola", graphOf(MOLHO, base))).toBe(true);
  });

  it("não usa o item", () => {
    const lines = [itemLine("pao", "1", "un"), prepLine("molho", "50", "g")];
    expect(usesItem(lines, "queijo", graphOf(MOLHO))).toBe(false);
  });
});
