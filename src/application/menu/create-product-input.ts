import type { RecipeLineData } from "@/domain/inventory/recipe";
import { parseBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";
import { formText } from "../form-input";
import { parseRecipeForm } from "../inventory/recipe-input";
import { parseSectionId } from "./details-input";

export type MenuProductInput = {
  name: string;
  lines: RecipeLineData[];
  salePrice: Decimal | null;
  sectionId: string | null;
  description: string;
};

/** O que o formulário de produto da 003 aceita e aqui não vem: pela tela Cardápio é sempre produto vendido. */
const NOT_FROM_FORM = ["kind", "yieldQuantity", "yieldUnit"];

/**
 * Formulário de produto novo da tela Cardápio (spec 013, US4): nome e linhas como na 003, mais
 * preço no formato brasileiro, seção e descrição. Em branco: sem preço, "Outros", sem descrição.
 */
export function parseMenuProductCreate(raw: Record<string, unknown>): Result<MenuProductInput> {
  const { salePrice, sectionId, description, ...recipeForm } = raw;
  if (NOT_FROM_FORM.some((key) => key in recipeForm)) return err("VALIDATION");
  const recipe = parseRecipeForm({ ...recipeForm, kind: "DISH" });
  if (!recipe.ok) return recipe;
  const priceText = formText(salePrice);
  const price = priceText ? parseBrDecimal(priceText) : ok(null);
  if (!price.ok) return err("INVALID_PRICE", "salePrice");
  const section = parseSectionId(sectionId);
  if (!section.ok) return section;
  return ok({
    name: recipe.value.name,
    lines: recipe.value.lines,
    salePrice: price.value,
    sectionId: section.value,
    description: typeof description === "string" ? description : "",
  });
}
