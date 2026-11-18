import { describe, it, expect } from "vitest";
import { COVER_OVERLAY, coverGradient, coverTextContrast } from "./cover-overlay";

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
});
