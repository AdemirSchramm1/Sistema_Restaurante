import { describe, it, expect } from "vitest";
import type { RecipeView } from "@/application/inventory/recipes";
import { d } from "@/domain/shared/decimal";
import { recipeToValues } from "./recipe-form-values";

const view = (recipe: Partial<RecipeView["recipe"]>, lines: RecipeView["lines"] = []): RecipeView => ({
  recipe: {
    id: "r1",
    name: "Molho de tomate",
    kind: "SUB_RECIPE",
    active: true,
    version: 1,
    yieldQuantity: d("2.5"),
    yieldUnit: "kg",
    ...recipe,
  },
  salePrice: null,
  versionNumber: 1,
  validFrom: new Date("2026-11-01T12:00:00Z"),
  lines,
  total: null,
  missingCostNames: [],
  costPerYieldUnit: null,
  usedBy: [],
});
const line = (over: Partial<RecipeView["lines"][number]>): RecipeView["lines"][number] => ({
  componentKind: "ITEM",
  componentId: "i1",
  name: "Tomate",
  componentActive: true,
  quantity: d("1.5"),
  unit: "kg",
  componentUnit: "kg",
  cost: null,
  missingCostNames: [],
  ...over,
});

describe("valores do formulário de produto", () => {
  it("rendimento e linhas com vírgula; o componente vira 'tipo:id'", () => {
    const v = recipeToValues(
      view({}, [line({}), line({ componentKind: "RECIPE", componentId: "r9", quantity: d(200), unit: "g" })]),
    );
    expect(v).toEqual({
      name: "Molho de tomate",
      kind: "SUB_RECIPE",
      yieldQuantity: "2,5",
      yieldUnit: "kg",
      lines: [
        { component: "ITEM:i1", quantity: "1,5", unit: "kg" },
        { component: "RECIPE:r9", quantity: "200", unit: "g" },
      ],
    });
  });

  it("prato sem rendimento: campo vazio e kg como medida padrão", () => {
    const v = recipeToValues(view({ kind: "DISH", yieldQuantity: null, yieldUnit: null }));
    expect(v.yieldQuantity).toBe("");
    expect(v.yieldUnit).toBe("kg");
    expect(v.lines).toEqual([]);
  });
});
