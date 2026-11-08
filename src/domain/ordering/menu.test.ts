import { describe, it, expect } from "vitest";
import { buildMenu, isOnMenu, type MenuProductRow } from "./menu";
import { d } from "../shared/decimal";

const row = (over: Partial<MenuProductRow> = {}): MenuProductRow => ({
  id: "x",
  name: "X-Burger",
  kind: "DISH",
  active: true,
  salePrice: d("28.00"),
  soldOutOn: null,
  ...over,
});
const today = "2026-11-08";

describe("o que aparece no cardápio (spec 009, US2-2, FR-004)", () => {
  it("produto vendido, ativo, com preço e não esgotado hoje", () => {
    expect(isOnMenu(row(), today)).toBe(true);
  });

  it("preparo, inativo e sem preço não aparecem", () => {
    expect(isOnMenu(row({ kind: "SUB_RECIPE", salePrice: null }), today)).toBe(false);
    expect(isOnMenu(row({ active: false }), today)).toBe(false);
    expect(isOnMenu(row({ salePrice: null }), today)).toBe(false);
  });

  it("esgotado hoje não aparece; esgotado ontem volta sozinho (spec 009, US5)", () => {
    expect(isOnMenu(row({ soldOutOn: today }), today)).toBe(false);
    expect(isOnMenu(row({ soldOutOn: "2026-11-07" }), today)).toBe(true);
  });

  it("ordem alfabética sem diferenciar acentos e maiúsculas", () => {
    const menu = buildMenu(
      [
        row({ id: "3", name: "Suco" }),
        row({ id: "1", name: "água" }),
        row({ id: "2", name: "Ômelete" }),
        row({ id: "4", name: "Bolo", active: false }),
      ],
      today,
    );
    expect(menu.map((p) => p.name)).toEqual(["água", "Ômelete", "Suco"]);
  });
});
