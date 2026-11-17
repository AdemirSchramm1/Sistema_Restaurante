import { describe, expect, it } from "vitest";
import { buildStaffMenu, staffProduct } from "./staff-menu";
import type { CatalogProduct } from "../ordering/checkout";
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
        product("Pão", { kind: "SUB_RECIPE" }),
        product("Chope", { sectionId: "bebidas", soldOutOn: today }),
      ],
      today,
    );
    expect(rows(menu)).toEqual(["Bebidas: Chope (esgotado)"]);
  });
});

describe("produto do cardápio da equipe com o catálogo de agora (spec 015, FR-003)", () => {
  const entry = (over: Partial<CatalogProduct> = {}): CatalogProduct => ({
    id: "x",
    name: "X-Burger",
    versionId: "v1",
    salePrice: d("28"),
    available: true,
    options: {
      addons: [
        { addonId: "queijo", name: "Fatia de queijo", price: d("3"), maxTimes: 2, available: true },
        { addonId: "velho", name: "Velho", price: d("1"), maxTimes: 1, available: false },
      ],
      removables: [
        { component: { kind: "ITEM", id: "cebola" }, label: "Sem cebola", available: true },
        { component: { kind: "ITEM", id: "alface" }, label: "Sem alface", available: false },
      ],
    },
    ...over,
  });
  const row = { description: "Da casa", photo: null, soldOut: false };

  it("com preço, adicionais e retiradas que valem hoje", () => {
    expect(staffProduct(row, entry())).toEqual([
      {
        id: "x",
        name: "X-Burger",
        price: "28.00",
        description: "Da casa",
        photo: null,
        soldOut: false,
        addons: [{ id: "queijo", name: "Fatia de queijo", price: "3.00", maxTimes: 2 }],
        removables: [{ kind: "ITEM", id: "cebola", label: "Sem cebola" }],
      },
    ]);
  });

  it("esgotado: apagado e sem escolhas", () => {
    expect(staffProduct({ ...row, soldOut: true }, entry({ available: false }))).toMatchObject([
      { soldOut: true, addons: [], removables: [] },
    ]);
  });

  it("saiu do cardápio entre as duas leituras: some", () => {
    expect(staffProduct(row, undefined)).toEqual([]);
    expect(staffProduct(row, entry({ salePrice: null }))).toEqual([]);
    expect(staffProduct(row, entry({ available: false }))).toEqual([]);
  });
});
