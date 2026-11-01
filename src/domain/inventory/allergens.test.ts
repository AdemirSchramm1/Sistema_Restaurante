import { describe, it, expect } from "vitest";
import { ALLERGENS, ALLERGEN_LABELS, isAllergen } from "./allergens";

describe("alérgenos da RDC 26/2015 (docs/produto/estoque/02-cadastro-de-itens.md#campos-do-cadastro)", () => {
  it("tem exatamente os 18 itens do anexo", () => {
    expect(ALLERGENS).toHaveLength(18);
    expect(new Set(ALLERGENS).size).toBe(18);
  });

  it("todo alérgeno tem rótulo em português", () => {
    for (const a of ALLERGENS) expect(ALLERGEN_LABELS[a].length).toBeGreaterThan(2);
    expect(ALLERGEN_LABELS.MILK).toBe("Leites de todas as espécies de mamíferos");
  });

  it("reconhece só valores da lista fechada", () => {
    expect(isAllergen("PEANUT")).toBe(true);
    expect(isAllergen("GLUTEN")).toBe(false);
  });
});
