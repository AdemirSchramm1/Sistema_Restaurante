// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { BoardProduct, MenuBoard as Board } from "@/application/menu/board";
import { MenuBoard, type MenuBoardActions } from "./menu-board";

afterEach(cleanup);

const noop = async () => null;
const actions: MenuBoardActions = {
  createSection: noop,
  renameSection: noop,
  moveSection: noop,
  deleteSection: noop,
  moveProduct: noop,
};
const product = (over: Partial<BoardProduct>): BoardProduct => ({
  id: "p1",
  name: "X-Burger",
  price: "28.00",
  active: true,
  soldOutToday: false,
  photo: { base: "/fotos/menu/abc", widths: [300, 600] },
  canMoveUp: false,
  canMoveDown: false,
  ...over,
});
const board: Board = {
  sections: [
    { id: "s1", name: "Entradas", version: 1, canMoveUp: false, canMoveDown: true, products: [] },
    {
      id: "s2",
      name: "Lanches",
      version: 2,
      canMoveUp: true,
      canMoveDown: false,
      products: [
        product({ canMoveDown: true }),
        product({ id: "p2", name: "X-Salada", price: null, active: false, photo: null, canMoveUp: true }),
      ],
    },
    {
      id: null,
      name: "Outros",
      version: null,
      canMoveUp: false,
      canMoveDown: false,
      products: [product({ id: "p3", name: "Suco", price: "9.00", soldOutToday: true, photo: null })],
    },
  ],
};
const show = (b: Board = board, canCreateProduct = true) =>
  render(<MenuBoard board={b} actions={actions} canCreateProduct={canCreateProduct} />);
const sectionOf = (name: string) => screen.getByRole("region", { name });

describe("tela Cardápio (spec 013, US2)", () => {
  it("as seções são títulos h2 na ordem, com Outros no fim", () => {
    show();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Entradas",
      "Lanches",
      "Outros",
    ]);
  });

  it("cada produto é um link para a sua tela, com o preço", () => {
    show();
    const lanches = within(sectionOf("Lanches"));
    expect(lanches.getByRole("link", { name: "X-Burger" }).getAttribute("href")).toBe("/pedidos/cardapio/p1");
    expect(lanches.getByRole("link", { name: "X-Salada" }).getAttribute("href")).toBe("/pedidos/cardapio/p2");
    expect(lanches.getAllByRole("listitem")[0]!.textContent).toContain("R$ 28,00");
  });

  it("os selos dizem o que falta para o cliente ver o produto", () => {
    show();
    const [burger, salada] = within(sectionOf("Lanches")).getAllByRole("listitem");
    expect(burger!.textContent).not.toMatch(/Sem preço|Inativo|Esgotado hoje|Sem foto/);
    expect(salada!.textContent).toContain("Sem preço");
    expect(salada!.textContent).toContain("Inativo");
    expect(salada!.textContent).toContain("Sem foto");
    const suco = within(sectionOf("Outros")).getByRole("listitem");
    expect(suco.textContent).toContain("Esgotado hoje");
    expect(suco.textContent).toContain("R$ 9,00");
  });

  it("produto com foto mostra a miniatura de 300 px em 4:3", () => {
    show();
    const img = within(sectionOf("Lanches")).getByRole<HTMLImageElement>("img", { name: "Foto de X-Burger" });
    expect(img.getAttribute("src")).toBe("/fotos/menu/abc/300.webp");
    expect([img.getAttribute("width"), img.getAttribute("height")]).toEqual(["120", "90"]);
    expect(img.dataset.photo).toBeDefined();
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(within(sectionOf("Outros")).queryByRole("img")).toBeNull();
  });

  it("seção vazia aparece e diz que está vazia", () => {
    show();
    expect(sectionOf("Entradas").textContent).toContain("Nenhum produto nesta seção");
  });

  it("seção tem subir, descer, renomear e apagar; Outros não tem", () => {
    show();
    const lanches = within(sectionOf("Lanches"));
    expect(lanches.getByRole<HTMLButtonElement>("button", { name: "Subir Lanches" }).disabled).toBe(false);
    expect(lanches.getByRole<HTMLButtonElement>("button", { name: "Descer Lanches" }).disabled).toBe(true);
    expect(lanches.getByLabelText<HTMLInputElement>("Nome da seção Lanches").value).toBe("Lanches");
    expect(lanches.getByRole("button", { name: "Apagar Lanches" })).toBeTruthy();
    // Renomear e apagar ficam recolhidos, para a lista de produtos não ficar longe do título.
    const details = lanches.getByText("Renomear ou apagar").closest("details")!;
    expect(details.open).toBe(false);
    expect(details.contains(lanches.getByLabelText("Nome da seção Lanches"))).toBe(true);
    expect(details.contains(lanches.getByRole("button", { name: "Subir Lanches" }))).toBe(false);
    const outros = within(sectionOf("Outros"));
    expect(outros.queryByRole("button", { name: /Outros/ })).toBeNull();
    expect(outros.queryByLabelText(/Nome da seção/)).toBeNull();
    expect(sectionOf("Outros").textContent).toContain("Produtos sem seção");
  });

  it("apagar avisa quantos produtos vão para Outros", () => {
    show();
    fireEvent.click(within(sectionOf("Lanches")).getByRole("button", { name: "Apagar Lanches" }));
    expect(screen.getByText("Os 2 produtos de Lanches vão para Outros")).toBeTruthy();
  });

  it("tem Nova seção, Novo produto e Ver como o cliente", () => {
    show();
    expect(screen.getByRole("form", { name: "Nova seção" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Novo produto" }).getAttribute("href")).toBe(
      "/pedidos/cardapio/novo",
    );
    expect(screen.getByRole("link", { name: "Ver como o cliente" }).getAttribute("href")).toBe(
      "/pedidos/cardapio/ver",
    );
  });

  it("quem não pode criar produto (chef sem recipe.write) não vê Novo produto", () => {
    show(board, false);
    expect(screen.queryByRole("link", { name: "Novo produto" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ver como o cliente" })).toBeTruthy();
  });

  it("cardápio vazio explica o primeiro passo", () => {
    show({ sections: [] });
    expect(screen.getByText("O cardápio ainda está vazio")).toBeTruthy();
    expect(screen.getByText(/Crie a primeira seção/)).toBeTruthy();
    expect(screen.getByRole("form", { name: "Nova seção" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });
});
