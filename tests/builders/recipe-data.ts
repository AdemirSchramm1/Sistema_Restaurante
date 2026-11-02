import { d } from "../../src/domain/shared/decimal";
import type { RecipeData, RecipeLineData } from "../../src/domain/inventory/recipe";
import type { UnitCode } from "../../src/domain/inventory/units";

export const itemLine = (id: string, quantity: string, unit: UnitCode): RecipeLineData => ({
  component: { kind: "ITEM", id },
  quantity: d(quantity),
  unit,
});

export const prepLine = (id: string, quantity: string, unit: UnitCode): RecipeLineData => ({
  component: { kind: "RECIPE", id },
  quantity: d(quantity),
  unit,
});

/** X-Burger: pão 1 un, carne 150 g, queijo 30 g. */
export function dishData(over: Partial<RecipeData> = {}): RecipeData {
  return {
    name: "X-Burger",
    kind: "DISH",
    yieldQuantity: null,
    yieldUnit: null,
    lines: [itemLine("pao", "1", "un"), itemLine("carne", "150", "g"), itemLine("queijo", "30", "g")],
    ...over,
  };
}

/** Molho de tomate que rende 2 kg. */
export function prepData(over: Partial<RecipeData> = {}): RecipeData {
  return {
    name: "Molho de tomate",
    kind: "SUB_RECIPE",
    yieldQuantity: d("2"),
    yieldUnit: "kg",
    lines: [itemLine("tomate", "2.5", "kg"), itemLine("cebola", "200", "g")],
    ...over,
  };
}
