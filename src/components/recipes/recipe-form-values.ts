import { formatBrDecimal } from "@/domain/shared/decimal";
import type { RecipeKind } from "@/domain/inventory/recipe";
import type { UnitCode } from "@/domain/inventory/units";
import type { RecipeView } from "@/application/inventory/recipes";

/** Valores do formulário de produto, sempre como texto (vírgula decimal). */
export type RecipeLineValues = { component: string; quantity: string; unit: UnitCode | "" };
export type RecipeFormValues = {
  name: string;
  kind: RecipeKind;
  yieldQuantity: string;
  yieldUnit: UnitCode;
  lines: RecipeLineValues[];
};

export const emptyLine: RecipeLineValues = { component: "", quantity: "", unit: "" };

export const emptyRecipeValues: RecipeFormValues = {
  name: "",
  kind: "DISH",
  yieldQuantity: "",
  yieldUnit: "kg",
  lines: [emptyLine],
};

export function recipeToValues(view: RecipeView): RecipeFormValues {
  return {
    name: view.recipe.name,
    kind: view.recipe.kind,
    yieldQuantity: view.recipe.yieldQuantity ? formatBrDecimal(view.recipe.yieldQuantity) : "",
    yieldUnit: view.recipe.yieldUnit ?? "kg",
    lines: view.lines.map((l) => ({
      component: `${l.componentKind}:${l.componentId}`,
      quantity: formatBrDecimal(l.quantity),
      unit: l.unit,
    })),
  };
}
