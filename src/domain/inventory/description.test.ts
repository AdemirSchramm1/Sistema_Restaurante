import { describe, it, expect } from "vitest";
import { normalizeDescription } from "./description";

describe("descrição normalizada para detectar duplicidade (FR-019)", () => {
  it("ignora maiúsculas e espaços repetidos", () => {
    expect(normalizeDescription("tomate  ITALIANO, caixa 20 kg, tipo aa")).toBe(
      normalizeDescription("Tomate italiano, caixa 20 kg, tipo AA"),
    );
  });

  it("ignora acentos", () => {
    expect(normalizeDescription("Pão francês")).toBe(normalizeDescription("pao  FRANCES"));
    expect(normalizeDescription("Pão francês")).toBe("pao frances");
  });

  it("remove espaços nas pontas e tabs", () => {
    expect(normalizeDescription("  Açúcar\tcristal  ")).toBe("acucar cristal");
  });
});
