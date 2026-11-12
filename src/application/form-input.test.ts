import { describe, expect, it } from "vitest";
import { formText } from "./form-input";

describe("formText (spec 012, FR-011)", () => {
  it("devolve o texto sem espaços nas pontas", () => {
    expect(formText("  Tomate italiano ")).toBe("Tomate italiano");
    expect(formText("Arroz")).toBe("Arroz");
  });

  it("o que não é texto vira texto vazio", () => {
    for (const v of [undefined, null, 3, true, ["a"], { a: 1 }]) expect(formText(v)).toBe("");
  });

  it("só espaços vira texto vazio", () => {
    expect(formText("   ")).toBe("");
  });
});
