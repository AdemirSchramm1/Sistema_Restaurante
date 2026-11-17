import { describe, expect, it } from "vitest";
import { buildStaffMenu } from "./staff-menu";
import { buildCustomerMenu, type CustomerMenuRow, type MenuSectionRow } from "./customer-menu";
import { d } from "../shared/decimal";

const today = "2026-11-17";
const product = (id: string, over: Partial<CustomerMenuRow> = {}): CustomerMenuRow => ({
  id,
  name: id,
  kind: "DISH",
  active: true,
  salePrice: d("10.00"),
  soldOutOn: null,
  description: null,
  photo: null,
  sectionId: "lanches",
  menuPosition: 1,
  ...over,
});
const sections: MenuSectionRow[] = [
  { id: "bebidas", name: "Bebidas", position: 2 },
  { id: "lanches", name: "Lanches", position: 1 },
];
const rows = (menu: { sections: { name: string; products: { id: string; soldOut: boolean }[] }[] }) =>
  menu.sections.map(
    (s) => `${s.name}: ${s.products.map((p) => (p.soldOut ? `${p.id} (esgotado)` : p.id)).join(", ")}`,
  );

describe("cardápio da equipe (spec 015, FR-003)", () => {
  it("mesmas seções, ordem e preços do cardápio do cliente quando nada está esgotado", () => {
    const products = [
      product("X-Burger", { menuPosition: 2 }),
      product("X-Salada", { menuPosition: 1 }),
      product("Chope", { sectionId: "bebidas", salePrice: d("12.00") }),
    ];
    const staff = buildStaffMenu(sections, products, today);
    const customer = buildCustomerMenu(sections, products, today);
    expect(rows(staff)).toEqual(["Lanches: X-Salada, X-Burger", "Bebidas: Chope"]);
    expect(staff.sections.map((s) => s.products.map((p) => p.id))).toEqual(
      customer.sections.map((s) => s.products.map((p) => p.id)),
    );
    expect(staff.showSectionTitles).toBe(true);
    expect(staff.sections[1]!.products[0]!.salePrice!.toFixed(2)).toBe("12.00");
  });

  it("esgotado hoje aparece apagado no fim da seção", () => {
    const menu = buildStaffMenu(
      sections,
      [
        product("Purê", { menuPosition: 1, soldOutOn: today }),
        product("X-Burger", { menuPosition: 2 }),
        product("X-Salada", { menuPosition: 3, soldOutOn: "2026-11-16" }),
      ],
      today,
    );
    expect(rows(menu)).toEqual(["Lanches: X-Burger, X-Salada, Purê (esgotado)"]);
  });

  it("sem preço, inativo ou insumo não aparece; seção só com esgotados continua", () => {
    const menu = buildStaffMenu(
      sections,
      [
        product("Sem preço", { salePrice: null }),
        product("Inativo", { active: false }),
        product("Pão", { kind: "PREP" }),
        product("Chope", { sectionId: "bebidas", soldOutOn: today }),
      ],
      today,
    );
    expect(rows(menu)).toEqual(["Bebidas: Chope (esgotado)"]);
  });
});
