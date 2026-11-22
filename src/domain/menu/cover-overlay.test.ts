import { describe, it, expect } from "vitest";
import { COVER_OVERLAY, coverGradient, coverTextContrast, srgbToLinear } from "./cover-overlay";

describe("camada escura da capa (spec 016, US1-3, R9)", () => {
  it("45% em cima e 70% embaixo, onde fica o texto", () => {
    expect(COVER_OVERLAY).toEqual({ top: 0.45, bottom: 0.7 });
    expect(coverGradient()).toBe("linear-gradient(to bottom, rgb(0 0 0 / 0.45), rgb(0 0 0 / 0.7))");
  });

  it("texto branco sobre a pior capa (toda branca) passa de 4,5:1", () => {
    expect(coverTextContrast()).toBeGreaterThanOrEqual(4.5);
    expect(coverTextContrast()).toBeCloseTo(8.4, 0);
  });

  it("a regra pega uma camada fraca demais: 30% embaixo não passa", () => {
    expect(coverTextContrast(0.3)).toBeLessThan(4.5);
  });

  it("camada quase preta: o cinza cai na parte linear da curva sRGB e o contraste chega perto de 21:1", () => {
    expect(coverTextContrast(0.97)).toBeGreaterThan(19);
  });

  it("curva sRGB: linear até 0,04045 (inclusive), potência 2,4 acima", () => {
    expect(srgbToLinear(0.04045)).toBe(0.04045 / 12.92);
    expect(srgbToLinear(0.04)).toBe(0.04 / 12.92);
    expect(srgbToLinear(0.5)).toBe(((0.5 + 0.055) / 1.055) ** 2.4);
  });
});
