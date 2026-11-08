// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MainNav, homeFor, navFor } from "./nav";

const labels = (roles: Parameters<typeof navFor>[0]) => navFor(roles).map((n) => n.label);

describe("menu por permissão (spec 009, T022)", () => {
  it("garçom vê só Garçom e Pedidos", () => {
    expect(labels(["WAITER"])).toEqual(["Garçom", "Pedidos"]);
  });

  it("chef vê a cozinha, os adicionais e o estoque, mas não mesas nem equipe", () => {
    const l = labels(["CHEF"]);
    expect(l).toEqual(
      expect.arrayContaining(["Cozinha", "Garçom", "Pedidos", "Adicionais", "Itens", "Produtos"]),
    );
    expect(l).not.toContain("Mesas");
    expect(l).not.toContain("Equipe");
  });

  it("gerente vê tudo", () => {
    expect(labels(["MANAGER"])).toEqual(
      expect.arrayContaining(["Mesas", "Cozinha", "Garçom", "Pedidos", "Adicionais", "Itens", "Equipe"]),
    );
  });

  it("estoquista não vê nada dos pedidos", () => {
    const l = labels(["STOCKKEEPER"]);
    for (const x of ["Mesas", "Cozinha", "Garçom", "Pedidos", "Adicionais"]) expect(l).not.toContain(x);
    expect(l).toContain("Itens");
  });

  it("primeira tela depende do papel", () => {
    expect(homeFor(["WAITER"])).toBe("/pedidos/garcom");
    expect(homeFor(["STOCKKEEPER"])).toBe("/estoque/itens");
    expect(homeFor(["MANAGER"])).toBe("/estoque/itens");
  });

  it("mostra os links do papel e a contagem do Repor", () => {
    render(<MainNav roles={["CHEF"]} reorderCount={3} />);
    const nav = screen.getByRole("navigation", { name: "Menu principal" });
    expect(within(nav).getByRole("link", { name: "Cozinha" }).getAttribute("href")).toBe("/pedidos/cozinha");
    expect(within(nav).getByLabelText("3 itens para repor")).toBeTruthy();
    expect(within(nav).queryByRole("link", { name: "Mesas" })).toBeNull();
  });
});
