// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MainNav, NAV, activeHref, homeFor, navFor, navSections } from "./nav";

afterEach(cleanup);

const labels = (roles: Parameters<typeof navFor>[0]) => navFor(roles).map((n) => n.label);

describe("menu por permissão (spec 009, T022)", () => {
  it("garçom vê Garçom, Caixa (só para ver a conta, spec 011) e Pedidos", () => {
    expect(labels(["WAITER"])).toEqual(["Garçom", "Caixa", "Pedidos"]);
  });

  it("caixa vê só Caixa, Contas e Pedidos e entra direto no Caixa (spec 011)", () => {
    expect(labels(["CASHIER"])).toEqual(["Caixa", "Contas", "Pedidos"]);
    expect(homeFor(["CASHIER"])).toBe("/caixa");
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
      expect.arrayContaining([
        "Mesas",
        "Cozinha",
        "Garçom",
        "Caixa",
        "Contas",
        "Pedidos",
        "Adicionais",
        "Itens",
        "Equipe",
      ]),
    );
  });

  it("estoquista não vê nada dos pedidos", () => {
    const l = labels(["STOCKKEEPER"]);
    for (const x of ["Mesas", "Cozinha", "Garçom", "Caixa", "Contas", "Pedidos", "Adicionais"])
      expect(l).not.toContain(x);
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

describe("menu lateral por área (spec 012, US2)", () => {
  const sectionsOf = (roles: Parameters<typeof navSections>[0]) =>
    navSections(roles).map((s) => [s.label, s.entries.map((e) => e.label)]);

  it("gerente vê Estoque, Operação e Configuração, sem mudar a ordem dos links", () => {
    expect(navSections(["MANAGER"]).map((s) => s.label)).toEqual(["Estoque", "Operação", "Configuração"]);
    expect(navSections(["MANAGER"]).flatMap((s) => s.entries)).toEqual(navFor(["MANAGER"]));
    expect(sectionsOf(["MANAGER"])).toEqual([
      [
        "Estoque",
        ["Itens", "Produtos", "Lançamentos", "Repor", "Gráficos", "Custos", "Fornecedores", "Grupos"],
      ],
      ["Operação", ["Cozinha", "Garçom", "Caixa", "Contas", "Pedidos"]],
      ["Configuração", ["Mesas", "Adicionais", "Equipe"]],
    ]);
  });

  it("área sem tela para o papel não aparece", () => {
    expect(sectionsOf(["CASHIER"])).toEqual([["Operação", ["Caixa", "Contas", "Pedidos"]]]);
    expect(sectionsOf(["WAITER"])).toEqual([["Operação", ["Garçom", "Caixa", "Pedidos"]]]);
    expect(navSections(["STOCKKEEPER"]).map((s) => s.label)).toEqual(["Estoque"]);
  });

  it("toda tela do menu tem área e ícone", () => {
    for (const n of NAV) {
      expect(["stock", "operation", "settings"]).toContain(n.section);
      expect(n.icon).toBeTruthy();
    }
  });

  it("a tela atual é o link mais específico que casa com o endereço", () => {
    const hrefs = NAV.map((n) => n.href);
    expect(activeHref("/caixa/contas", hrefs)).toBe("/caixa/contas");
    expect(activeHref("/caixa", hrefs)).toBe("/caixa");
    expect(activeHref("/caixa/3f6c", hrefs)).toBe("/caixa");
    expect(activeHref("/pedidos/cozinha", hrefs)).toBe("/pedidos/cozinha");
    expect(activeHref("/pedidos/42", hrefs)).toBe("/pedidos");
    expect(activeHref("/estoque/itens/123", hrefs)).toBe("/estoque/itens");
    expect(activeHref("/estoque/itensx", hrefs)).toBeNull();
    expect(activeHref("/", hrefs)).toBeNull();
    expect(activeHref("/caixa/contas", ["/caixa"])).toBe("/caixa");
  });

  it("destaca só a tela atual, com aria-current", () => {
    render(<MainNav roles={["MANAGER"]} reorderCount={0} pathname="/caixa/contas" />);
    const nav = screen.getByRole("navigation", { name: "Menu principal" });
    expect(within(nav).getByRole("link", { name: "Contas" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "Caixa" }).getAttribute("aria-current")).toBeNull();
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("os links ficam em listas com o nome da área; o texto do link é só o nome da tela", () => {
    render(<MainNav roles={["CASHIER"]} reorderCount={0} pathname="/caixa" />);
    const list = screen.getByRole("list", { name: "Operação" });
    expect(
      within(list)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Caixa", "Contas", "Pedidos"]);
    expect(screen.queryByRole("list", { name: "Estoque" })).toBeNull();
  });

  it("escolher uma tela avisa quem abriu o menu", () => {
    const onNavigate = vi.fn();
    render(<MainNav roles={["CASHIER"]} reorderCount={0} pathname="/caixa" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("link", { name: "Contas" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
