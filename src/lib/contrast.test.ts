import { describe, it, expect } from "vitest";
import { contrastRatio, luminanceOfOklch, parseOklch } from "./contrast";

const srgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(lin) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe("contraste WCAG das cores do tema (spec 012, FR-002)", () => {
  it("branco sobre preto dá 21:1", () => {
    expect(contrastRatio(1, 0)).toBeCloseTo(21, 5);
  });

  it("cinza #777 sobre branco fica logo abaixo de 4,5:1", () => {
    expect(contrastRatio(srgb("#ffffff"), srgb("#777777"))).toBeCloseTo(4.48, 2);
  });

  it("a ordem das cores não muda o contraste", () => {
    expect(contrastRatio(0.2, 0.8)).toBe(contrastRatio(0.8, 0.2));
  });

  it("lê oklch(L C H) com ou sem porcentagem", () => {
    expect(parseOklch("oklch(0.5 0.1 150)")).toEqual({ l: 0.5, c: 0.1, h: 150 });
    expect(parseOklch("oklch(50% 0.1 150)")).toEqual({ l: 0.5, c: 0.1, h: 150 });
    expect(parseOklch("rgb(0 0 0)")).toBeNull();
  });

  it("OKLCH de branco e preto dá luminância 1 e 0", () => {
    expect(luminanceOfOklch({ l: 1, c: 0, h: 0 })).toBeCloseTo(1, 4);
    expect(luminanceOfOklch({ l: 0, c: 0, h: 0 })).toBeCloseTo(0, 6);
  });

  it("confere com a conversão de referência (oklch(0.628 0.2577 29.23) ≈ #ff0000)", () => {
    expect(luminanceOfOklch({ l: 0.628, c: 0.2577, h: 29.23 })).toBeCloseTo(srgb("#ff0000"), 2);
  });

  it("cor fora da faixa do sRGB é limitada, sem luminância negativa ou acima de 1", () => {
    const y = luminanceOfOklch({ l: 0.9, c: 0.4, h: 140 });
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(1);
  });
});
