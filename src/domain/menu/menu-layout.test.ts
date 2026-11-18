import { describe, it, expect } from "vitest";
import { CART_COLUMN_PX, LAYOUT_BREAKPOINTS, cartBeside, menuLayout } from "./menu-layout";

describe("layout do cardápio por largura (spec 016, FR-002, R10)", () => {
  it.each([
    [320, "list"],
    [390, "list"],
    [599, "list"],
    [600, "grid3"],
    [768, "grid3"],
    [820, "grid3"],
    [844, "grid3"],
    [1023, "grid3"],
    [1024, "grid3side"],
    [1279, "grid3side"],
    [1280, "grid4side"],
    [1920, "grid4side"],
  ] as const)("%i px → %s", (width, layout) => {
    expect(menuLayout(width)).toBe(layout);
  });

  it("carrinho ao lado só nas telas largas; coluna de 320 px", () => {
    expect(cartBeside("list")).toBe(false);
    expect(cartBeside("grid3")).toBe(false);
    expect(cartBeside("grid3side")).toBe(true);
    expect(cartBeside("grid4side")).toBe(true);
    expect(CART_COLUMN_PX).toBe(320);
    expect(LAYOUT_BREAKPOINTS).toEqual({ tab: 600, lg: 1024, xl: 1280 });
  });
});

describe("os pontos do CSS são os mesmos da função (T020)", () => {
  it("app/globals.css declara --breakpoint-tab de 600 px e não muda lg e xl do Tailwind", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(new URL("../../../app/globals.css", import.meta.url), "utf8");
    expect(css).toMatch(new RegExp(`--breakpoint-tab:\\s*${LAYOUT_BREAKPOINTS.tab / 16}rem;`));
    expect(css).not.toMatch(/--breakpoint-(lg|xl):/);
    // Padrão do Tailwind 4: lg 64rem e xl 80rem.
    expect([LAYOUT_BREAKPOINTS.lg / 16, LAYOUT_BREAKPOINTS.xl / 16]).toEqual([64, 80]);
  });
});
