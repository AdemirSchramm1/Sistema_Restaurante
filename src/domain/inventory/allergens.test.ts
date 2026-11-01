import { describe, it, expect } from "vitest";
import { ALLERGENS, ALLERGEN_LABELS, isAllergen } from "./allergens";

/** Texto do Anexo III da RDC Anvisa 727/2022 (que consolidou a RDC 26/2015), conferido em 01/11/2026. */
const ANEXO_III = [
  "Trigo, centeio, cevada, aveia e suas estirpes hibridizadas",
  "Crustáceos",
  "Ovos",
  "Peixes",
  "Amendoim",
  "Soja",
  "Leites de todas as espécies de animais mamíferos",
  "Amêndoa",
  "Avelãs",
  "Castanha-de-caju",
  "Castanha-do-brasil ou castanha-do-pará",
  "Macadâmias",
  "Nozes",
  "Pecãs",
  "Pistaches",
  "Pinoli",
  "Castanhas",
  "Látex natural",
];

describe("alérgenos do Anexo III da RDC 727/2022 (docs/produto/estoque/02-cadastro-de-itens.md#campos-do-cadastro)", () => {
  it("tem exatamente os 18 itens do anexo, na ordem e com o texto oficial", () => {
    expect(ALLERGENS).toHaveLength(18);
    expect(ALLERGENS.map((a) => ALLERGEN_LABELS[a])).toEqual(ANEXO_III);
  });

  it("reconhece só valores da lista fechada", () => {
    expect(isAllergen("PEANUT")).toBe(true);
    expect(isAllergen("GLUTEN")).toBe(false);
  });
});
