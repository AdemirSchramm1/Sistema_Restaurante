// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MainNav, NAV, activeHref, homeFor, navFor, navSections } from "./nav";

afterEach(cleanup);

const labels = (roles: Parameters<typeof navFor>[0]) => navFor(roles).map((n) => n.label);

describe("menu por permissão (spec 009, T022)", () => {
  it("garçom vê Lançar pedido (spec 015), Garçom, Caixa (só para ver a conta, spec 011) e Pedidos", () => {
    expect(labels(["WAITER"])).toEqual(["Lançar pedido", "Garçom", "Caixa", "Pedidos"]);
  });

  it("caixa vê só Caixa, Contas, Turnos e Pedidos e entra direto no Caixa (specs 011 e 014)", () => {
    expect(labels(["CASHIER"])).toEqual(["Lançar pedido", "Caixa", "Contas", "Turnos", "Pedidos"]);
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

  it("só o gerente vê a Auditoria, depois da Equipe (spec 019)", () => {
    const l = labels(["MANAGER"]);
    expect(l.slice(l.indexOf("Equipe"))).toEqual(["Equipe", "Auditoria"]);
    for (const r of ["CHEF", "STOCKKEEPER", "BUYER", "ADMINISTRATIVE", "WAITER", "CASHIER"] as const)
      expect(labels([r])).not.toContain("Auditoria");
    expect(NAV.find((n) => n.label === "Auditoria")?.href).toBe("/equipe/auditoria");
  });

  it("estoquista não vê nada dos pedidos", () => {
    const l = labels(["STOCKKEEPER"]);
    for (const x of ["Mesas", "Cozinha", "Garçom", "Caixa", "Contas", "Pedidos", "Adicionais"])
      expect(l).not.toContain(x);
    expect(l).toContain("Itens");
  });

  it("primeira tela depende do papel", () => {
    // Spec 015, R15: o garçom entra no Lançar pedido; caixa, chef e gerente continuam onde estavam.
    expect(homeFor(["WAITER"])).toBe("/pedidos/lancar");
    expect(homeFor(["CHEF"])).toBe("/estoque/itens");
    expect(homeFor(["STOCKKEEPER"])).toBe("/estoque/itens");
    expect(homeFor(["MANAGER"])).toBe("/estoque/itens");
    expect(homeFor([])).toBe("/sem-acesso");
  });

  it("um item para repor fica no singular", () => {
    render(<MainNav roles={["CHEF"]} reorderCount={1} />);
    expect(screen.getByLabelText("1 item para repor")).toBeTruthy();
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
      // "Cardápio" entrou na spec 013 (tela da equipe para editar o cardápio).
      // "Turnos" e "Vendas" entraram na spec 014 (caixa do dia); "Lançar pedido", na 015.
      [
        "Operação",
        ["Cozinha", "Lançar pedido", "Garçom", "Caixa", "Contas", "Turnos", "Vendas", "Pedidos", "Cardápio"],
      ],
      ["Configuração", ["Mesas", "Adicionais", "Equipe"]],
    ]);
  });

  it("área sem tela para o papel não aparece", () => {
    expect(sectionsOf(["CASHIER"])).toEqual([
      ["Operação", ["Lançar pedido", "Caixa", "Contas", "Turnos", "Pedidos"]],
    ]);
    expect(sectionsOf(["WAITER"])).toEqual([["Operação", ["Lançar pedido", "Garçom", "Caixa", "Pedidos"]]]);
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
    expect(activeHref("/pedidos/lancar/m12", hrefs)).toBe("/pedidos/lancar");
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
    ).toEqual(["Lançar pedido", "Caixa", "Contas", "Turnos", "Pedidos"]);
    expect(screen.queryByRole("list", { name: "Estoque" })).toBeNull();
  });

  it("escolher uma tela avisa quem abriu o menu", () => {
    const onNavigate = vi.fn();
    render(<MainNav roles={["CASHIER"]} reorderCount={0} pathname="/caixa" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("link", { name: "Contas" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

describe("entrada Cardápio no menu (spec 013, US2)", () => {
  it("aparece em Operação para gerente e chef, e para mais ninguém", () => {
    for (const role of ["MANAGER", "CHEF"] as const) {
      const operation = navSections([role]).find((s) => s.id === "operation")!;
      expect(operation.entries.map((e) => e.label)).toContain("Cardápio");
    }
    for (const role of ["STOCKKEEPER", "BUYER", "ADMINISTRATIVE", "WAITER", "CASHIER"] as const)
      expect(labels([role])).not.toContain("Cardápio");
    expect(NAV.find((n) => n.label === "Cardápio")).toMatchObject({
      href: "/pedidos/cardapio",
      action: "menu.write",
      section: "operation",
    });
  });

  it("em /pedidos/cardapio (e nas telas de dentro) só Cardápio fica marcado, não Pedidos", () => {
    for (const pathname of ["/pedidos/cardapio", "/pedidos/cardapio/novo", "/pedidos/cardapio/ver"]) {
      render(<MainNav roles={["MANAGER"]} reorderCount={0} pathname={pathname} />);
      const current = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
      expect(current.map((a) => a.textContent)).toEqual(["Cardápio"]);
      cleanup();
    }
  });
});

describe("entrada Turnos no menu (spec 014, US5)", () => {
  it("aparece em Operação para quem vê os turnos (gerente e caixa); o garçom não vê", () => {
    for (const role of ["MANAGER", "CASHIER"] as const) {
      const entry = navFor([role]).find((n) => n.label === "Turnos");
      expect(entry).toMatchObject({ href: "/caixa/turnos", action: "cash.history", section: "operation" });
    }
    for (const role of ["WAITER", "CHEF", "STOCKKEEPER"] as const)
      expect(labels([role])).not.toContain("Turnos");
  });

  it("fica ativo na lista e no relatório de um turno, no lugar de Caixa", () => {
    const hrefs = NAV.map((n) => n.href);
    expect(activeHref("/caixa/turnos", hrefs)).toBe("/caixa/turnos");
    expect(activeHref("/caixa/turnos/3f6c/imprimir", hrefs)).toBe("/caixa/turnos");
    expect(activeHref("/caixa/fechar", hrefs)).toBe("/caixa");
  });
});

describe("entrada Vendas no menu (spec 014, US6)", () => {
  it("só o gerente vê, em Operação", () => {
    expect(navFor(["MANAGER"]).find((n) => n.label === "Vendas")).toMatchObject({
      href: "/vendas",
      action: "sales.report",
      section: "operation",
    });
    for (const role of ["CASHIER", "WAITER", "CHEF", "STOCKKEEPER"] as const)
      expect(labels([role])).not.toContain("Vendas");
  });
});
