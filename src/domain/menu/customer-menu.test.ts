import { describe, expect, it } from "vitest";
import { buildCustomerMenu, menuProducts, type CustomerMenuRow, type MenuSectionRow } from "./customer-menu";
import { d } from "../shared/decimal";

const today = "2026-11-13";
const product = (id: string, over: Partial<CustomerMenuRow> = {}): CustomerMenuRow => ({
  id,
  name: id,
  kind: "DISH",
  active: true,
  salePrice: d("10.00"),
  soldOutOn: null,
  description: null,
  photo: null,
  sectionId: null,
  menuPosition: 1,
  ...over,
});
const sections: MenuSectionRow[] = [
  { id: "bebidas", name: "Bebidas", position: 2 },
  { id: "entradas", name: "Entradas", position: 1 },
  { id: "lanches", name: "Lanches", position: 3 },
];
const names = (menu: { sections: { name: string; products: { id: string }[] }[] }) =>
  menu.sections.map((s) => `${s.name}: ${s.products.map((p) => p.id).join(", ")}`);

describe("cardápio do cliente por seção (docs/produto/pedidos/02-cardapio-do-cliente.md#seções-e-ordem)", () => {
  it("seções na ordem escolhida, produtos pela posição e Outros no fim", () => {
    const menu = buildCustomerMenu(
      sections,
      [
        product("Sem seção", { menuPosition: 1 }),
        product("X-Burger", { sectionId: "lanches", menuPosition: 2 }),
        product("X-Salada", { sectionId: "lanches", menuPosition: 1 }),
        product("Suco", { sectionId: "bebidas", menuPosition: 1 }),
        product("Bolinho", { sectionId: "entradas", menuPosition: 1 }),
      ],
      today,
    );
    expect(menu.showSectionTitles).toBe(true);
    expect(names(menu)).toEqual([
      "Entradas: Bolinho",
      "Bebidas: Suco",
      "Lanches: X-Salada, X-Burger",
      "Outros: Sem seção",
    ]);
    expect(menu.sections.map((s) => s.id)).toEqual(["entradas", "bebidas", "lanches", null]);
  });

  it("posição igual desempata pelo nome, sem diferenciar acentos", () => {
    const menu = buildCustomerMenu(
      [],
      [product("Suco"), product("água"), product("Ômelete"), product("Bolo", { menuPosition: 0 })],
      today,
    );
    expect(menuProducts(menu).map((p) => p.id)).toEqual(["Bolo", "água", "Ômelete", "Suco"]);
  });

  it("some o que o cliente não pode pedir: inativo, sem preço, esgotado hoje e preparo", () => {
    const menu = buildCustomerMenu(
      sections,
      [
        product("Vale", { sectionId: "lanches" }),
        product("Inativo", { sectionId: "lanches", active: false }),
        product("Sem preço", { sectionId: "lanches", salePrice: null }),
        product("Esgotado", { sectionId: "lanches", soldOutOn: today }),
        product("Voltou", { sectionId: "lanches", soldOutOn: "2026-11-12", menuPosition: 2 }),
        product("Molho", { sectionId: "lanches", kind: "SUB_RECIPE" }),
      ],
      today,
    );
    expect(names(menu)).toEqual(["Lanches: Vale, Voltou"]);
  });

  it("seção sem produto que o cliente possa pedir não aparece", () => {
    const menu = buildCustomerMenu(
      sections,
      [
        product("Suco", { sectionId: "bebidas" }),
        product("Parado", { sectionId: "entradas", active: false }),
      ],
      today,
    );
    expect(names(menu)).toEqual(["Bebidas: Suco"]);
    expect(menu.showSectionTitles).toBe(true);
  });

  it("quando nenhum produto tem seção, vem uma lista só e sem títulos", () => {
    const menu = buildCustomerMenu(
      sections,
      [product("Suco", { menuPosition: 2 }), product("X-Burger", { menuPosition: 1 })],
      today,
    );
    expect(menu.showSectionTitles).toBe(false);
    expect(names(menu)).toEqual(["Outros: X-Burger, Suco"]);
  });

  it("títulos só contam produtos que aparecem: seção só com produto esgotado não liga os títulos", () => {
    const menu = buildCustomerMenu(
      sections,
      [product("Suco"), product("Esgotado", { sectionId: "lanches", soldOutOn: today })],
      today,
    );
    expect(menu.showSectionTitles).toBe(false);
    expect(names(menu)).toEqual(["Outros: Suco"]);
  });

  it("produto apontando para seção que não veio vai para Outros", () => {
    const menu = buildCustomerMenu(sections, [product("Órfão", { sectionId: "apagada" })], today);
    expect(names(menu)).toEqual(["Outros: Órfão"]);
    expect(menu.showSectionTitles).toBe(false);
  });

  it("cardápio vazio não tem seções", () => {
    expect(buildCustomerMenu(sections, [], today)).toEqual({ showSectionTitles: false, sections: [] });
  });

  it("descrição e foto acompanham o produto, e a lista recebida não muda", () => {
    const photo = { base: "/fotos/menu/abc", widths: [300, 600] };
    const rows = [
      product("B", { menuPosition: 2 }),
      product("A", { description: "Pão e carne", photo, menuPosition: 1 }),
    ];
    const menu = buildCustomerMenu([], rows, today);
    expect(menuProducts(menu)[0]).toMatchObject({ id: "A", description: "Pão e carne", photo });
    expect(rows.map((r) => r.id)).toEqual(["B", "A"]);
  });

  it("menuProducts devolve os produtos na ordem do cardápio", () => {
    const menu = buildCustomerMenu(
      sections,
      [
        product("Fim"),
        product("Suco", { sectionId: "bebidas" }),
        product("Bolinho", { sectionId: "entradas" }),
      ],
      today,
    );
    expect(menuProducts(menu).map((p) => p.id)).toEqual(["Bolinho", "Suco", "Fim"]);
  });
});
