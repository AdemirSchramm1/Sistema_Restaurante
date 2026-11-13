import { describe, expect, it } from "vitest";
import { checkSectionName, MAX_SECTION_NAME, OTHER_SECTION } from "./section";

const existing = [
  { id: "s1", name: "Lanches", normalized: "lanches" },
  { id: "s2", name: "Bebidas", normalized: "bebidas" },
];

describe("nome da seção (docs/produto/pedidos/06-editar-o-cardapio.md#seções)", () => {
  it("devolve o nome sem espaços nas pontas e a forma de comparar", () => {
    expect(checkSectionName("  Sobremesas  ", existing)).toEqual({
      ok: true,
      value: { name: "Sobremesas", normalized: "sobremesas" },
    });
  });

  it("nome vazio ou só com espaços é INVALID_NAME no campo", () => {
    for (const name of ["", "   "])
      expect(checkSectionName(name, existing)).toEqual({
        ok: false,
        error: { code: "INVALID_NAME", field: "name", details: { max: 40 } },
      });
  });

  it("aceita 40 caracteres e recusa 41", () => {
    expect(MAX_SECTION_NAME).toBe(40);
    expect(checkSectionName("a".repeat(40), existing).ok).toBe(true);
    expect(checkSectionName("a".repeat(41), existing)).toEqual({
      ok: false,
      error: { code: "INVALID_NAME", field: "name", details: { max: 40 } },
    });
  });

  it("nome repetido sem diferenciar maiúsculas, acentos e espaços é NAME_IN_USE com o nome que já existe", () => {
    for (const name of ["lanches", "LANCHES", "Lánches", " Lanches  "])
      expect(checkSectionName(name, existing)).toEqual({
        ok: false,
        error: { code: "NAME_IN_USE", field: "name", details: { section: "Lanches" } },
      });
  });

  it("renomear para o próprio nome passa; para o de outra seção, não", () => {
    expect(checkSectionName("Lanches", existing, "s1").ok).toBe(true);
    expect(checkSectionName("Bebidas", existing, "s1").ok).toBe(false);
  });

  it('"Outros" é o nome dos produtos sem seção e não pode ser usado', () => {
    expect(OTHER_SECTION).toBe("Outros");
    expect(checkSectionName("outros", [])).toEqual({
      ok: false,
      error: { code: "NAME_IN_USE", field: "name", details: { section: "Outros" } },
    });
  });
});
