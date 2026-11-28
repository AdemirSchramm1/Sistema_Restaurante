import { describe, it, expect } from "vitest";
import { can, assertCan, ACTIONS, ROLES, ROLE_LABELS, type Role } from "./permissions";

describe("matriz de permissões (spec 001, FR-003)", () => {
  it("gerente pode tudo", () => {
    for (const action of ACTIONS) expect(can(["MANAGER"], action), action).toBe(true);
  });

  it("chef consulta, escreve itens e produtos, lança perda e pede acerto (specs 003 e 004)", () => {
    const allowed = ACTIONS.filter((a) => can(["CHEF"], a));
    expect(allowed.sort()).toEqual([
      "addon.read",
      "adjustment.request",
      "catalog.read",
      "item.reorder",
      "item.write",
      "menu.write",
      "movement.loss",
      "order.cancel",
      "order.deliver",
      "order.kitchen",
      "order.read",
      "product.sold_out",
      "recipe.write",
    ]);
  });

  it("lançamentos por papel (spec 004, FR-006)", () => {
    const allowed = (role: Role) => ACTIONS.filter((a) => can([role], a)).sort();
    expect(allowed("STOCKKEEPER")).toEqual([
      "adjustment.request",
      "catalog.read",
      "movement.loss",
      "movement.purchase",
    ]);
    expect(allowed("BUYER")).toEqual([
      "adjustment.request",
      "catalog.read",
      "item.reorder",
      "movement.purchase",
      "supplier.write",
    ]);
    expect(allowed("ADMINISTRATIVE")).toEqual(["catalog.read"]);
    expect(can(["MANAGER"], "adjustment.approve")).toBe(true);
    expect(can(["MANAGER"], "movement.reverse")).toBe(true);
    for (const r of ["CHEF", "STOCKKEEPER", "BUYER", "ADMINISTRATIVE"] as Role[]) {
      expect(can([r], "adjustment.approve"), r).toBe(false);
      expect(can([r], "movement.reverse"), r).toBe(false);
    }
  });

  it("fornecedores: só gerente e comprador cadastram (spec 007, FR-006)", () => {
    expect(can(["MANAGER"], "supplier.write")).toBe(true);
    expect(can(["BUYER"], "supplier.write")).toBe(true);
    for (const r of ["CHEF", "STOCKKEEPER", "ADMINISTRATIVE"] as Role[])
      expect(can([r], "supplier.write"), r).toBe(false);
  });

  it("usuário com vários papéis soma as permissões", () => {
    expect(can(["STOCKKEEPER", "CHEF"], "item.write")).toBe(true);
  });

  it("sem papel não pode nada", () => {
    expect(ACTIONS.some((a) => can([], a))).toBe(false);
  });

  it("assertCan devolve FORBIDDEN quando não pode", () => {
    const r = assertCan(["CHEF"], "group.manage");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
    expect(assertCan(["MANAGER"], "group.manage").ok).toBe(true);
  });

  it("não existe mais permissão de locais (spec 002, US3)", () => {
    expect(ACTIONS).not.toContain("location.manage" as never);
    expect(ACTIONS).not.toContain("item_location.manage" as never);
  });
});

describe("aviso de reposição (spec 006, FR-002)", () => {
  it("item.reorder só para gerente, chef e comprador", () => {
    const who = (["MANAGER", "CHEF", "STOCKKEEPER", "BUYER", "ADMINISTRATIVE"] as Role[]).filter((r) =>
      can([r], "item.reorder"),
    );
    expect(who).toEqual(["MANAGER", "CHEF", "BUYER"]);
  });
});

describe("pedidos pelo QR code (spec 009, FR-010) e adicionais (spec 010, FR-008)", () => {
  const ALL: Role[] = ["MANAGER", "CHEF", "STOCKKEEPER", "BUYER", "ADMINISTRATIVE", "WAITER"];
  const who = (a: Parameters<typeof can>[1]) => ALL.filter((r) => can([r], a));

  it("papel Garçom existe, em português", () => {
    expect(ROLES).toContain("WAITER");
    expect(ROLE_LABELS.WAITER).toBe("Garçom");
  });

  it("garçom só vê prontos, marca entregue, consulta pedidos e vê a conta (spec 011); não vê estoque", () => {
    expect(ACTIONS.filter((a) => can(["WAITER"], a)).sort()).toEqual([
      "order.cancel_own",
      "order.deliver",
      "order.place",
      "order.read",
      "tab.read",
    ]);
    expect(can(["WAITER"], "catalog.read")).toBe(false);
  });

  it("matriz das ações novas", () => {
    expect(who("table.manage")).toEqual(["MANAGER"]);
    expect(who("ordering.toggle")).toEqual(["MANAGER"]);
    expect(who("order.kitchen")).toEqual(["MANAGER", "CHEF"]);
    expect(who("order.cancel")).toEqual(["MANAGER", "CHEF"]);
    expect(who("product.sold_out")).toEqual(["MANAGER", "CHEF"]);
    expect(who("order.deliver")).toEqual(["MANAGER", "CHEF", "WAITER"]);
    expect(who("order.read")).toEqual(["MANAGER", "CHEF", "WAITER"]);
  });

  it("preços de adicionais só o gerente muda; o chef vê", () => {
    expect(who("addon.write")).toEqual(["MANAGER"]);
    expect(who("addon.read")).toEqual(["MANAGER", "CHEF"]);
  });
});

describe("conta da mesa e caixa (spec 011, FR-010)", () => {
  const ALL: Role[] = ["MANAGER", "CHEF", "STOCKKEEPER", "BUYER", "ADMINISTRATIVE", "WAITER", "CASHIER"];
  const who = (a: Parameters<typeof can>[1]) => ALL.filter((r) => can([r], a));

  it("papel Caixa existe, em português", () => {
    expect(ROLES).toContain("CASHIER");
    expect(ROLE_LABELS.CASHIER).toBe("Caixa");
  });

  it("caixa vê o caixa, recebe, fecha e consulta contas e pedidos; não vê estoque nem cozinha", () => {
    expect(ACTIONS.filter((a) => can(["CASHIER"], a)).sort()).toEqual([
      "cash.history",
      "cash.operate",
      "order.cancel_own",
      "order.place",
      "order.read",
      "tab.history",
      "tab.pay",
      "tab.read",
    ]);
  });

  it("matriz das ações novas", () => {
    expect(who("tab.read")).toEqual(["MANAGER", "WAITER", "CASHIER"]);
    expect(who("tab.pay")).toEqual(["MANAGER", "CASHIER"]);
    expect(who("tab.history")).toEqual(["MANAGER", "CASHIER"]);
    expect(who("tab.reopen")).toEqual(["MANAGER"]);
    expect(who("tab.settings")).toEqual(["MANAGER"]);
    expect(who("order.read")).toEqual(["MANAGER", "CHEF", "WAITER", "CASHIER"]);
  });
});

describe("editar o cardápio (spec 013, FR-001)", () => {
  const ALL: Role[] = ["MANAGER", "CHEF", "STOCKKEEPER", "BUYER", "ADMINISTRATIVE", "WAITER", "CASHIER"];

  it("menu.write é do gerente e do chef, e de mais ninguém", () => {
    expect(ALL.filter((r) => can([r], "menu.write"))).toEqual(["MANAGER", "CHEF"]);
  });

  it("aparência (logo e capa) só do gerente; o tablet da mesa fica com table.manage (spec 016, FR-009)", () => {
    expect(ALL.filter((r) => can([r], "menu.appearance"))).toEqual(["MANAGER"]);
    expect(can(["CHEF"], "menu.write")).toBe(true);
    expect(can(["CHEF"], "menu.appearance")).toBe(false);
    expect(ALL.filter((r) => can([r], "table.manage"))).toEqual(["MANAGER"]);
  });
});

describe("caixa do dia (spec 014, FR-008)", () => {
  const ALL: Role[] = ["MANAGER", "CHEF", "STOCKKEEPER", "BUYER", "ADMINISTRATIVE", "WAITER", "CASHIER"];
  const who = (a: Parameters<typeof can>[1]) => ALL.filter((r) => can([r], a));

  it("abrir, sangria, reforço, fechar o próprio turno e ver turnos fechados: gerente e caixa", () => {
    expect(who("cash.operate")).toEqual(["MANAGER", "CASHIER"]);
    expect(who("cash.history")).toEqual(["MANAGER", "CASHIER"]);
  });

  it("fechar o turno de outra pessoa, ver o esperado do turno aberto e Vendas: só o gerente", () => {
    expect(who("cash.close_any")).toEqual(["MANAGER"]);
    expect(who("cash.expected")).toEqual(["MANAGER"]);
    expect(who("sales.report")).toEqual(["MANAGER"]);
  });

  it("garçom e chef não têm nenhuma ação do caixa do dia", () => {
    const cash = ACTIONS.filter((a) => a.startsWith("cash.") || a === "sales.report");
    expect(cash).toHaveLength(5);
    for (const role of ["WAITER", "CHEF"] as const) expect(cash.filter((a) => can([role], a))).toEqual([]);
  });
});

describe("auditoria e operação pequena (spec 019, FR-001 e FR-006)", () => {
  const ALL: Role[] = ["MANAGER", "CHEF", "STOCKKEEPER", "BUYER", "ADMINISTRATIVE", "WAITER", "CASHIER"];
  const who = (a: Parameters<typeof can>[1]) => ALL.filter((r) => can([r], a));

  it("relatório de auditoria e modo operação pequena: só o gerente", () => {
    expect(who("audit.read")).toEqual(["MANAGER"]);
    expect(who("restaurant.small_operation")).toEqual(["MANAGER"]);
  });
});

describe("garçom lança o pedido da mesa (spec 015, FR-001 e FR-010)", () => {
  const ALL: Role[] = ["MANAGER", "CHEF", "STOCKKEEPER", "BUYER", "ADMINISTRATIVE", "WAITER", "CASHIER"];
  const who = (a: Parameters<typeof can>[1]) => ALL.filter((r) => can([r], a));

  it("lançar pedido e cancelar o próprio: gerente, garçom e caixa", () => {
    expect(who("order.place")).toEqual(["MANAGER", "WAITER", "CASHIER"]);
    expect(who("order.cancel_own")).toEqual(["MANAGER", "WAITER", "CASHIER"]);
  });

  it("cancelar qualquer pedido continua só com gerente e chef", () => {
    expect(who("order.cancel")).toEqual(["MANAGER", "CHEF"]);
  });
});

describe("nomes dos papéis e recusa (spec 018, R4)", () => {
  it("cada papel tem o nome que a pessoa vê", () => {
    expect(ROLE_LABELS).toEqual({
      MANAGER: "Gerente",
      CHEF: "Chef",
      STOCKKEEPER: "Estoquista",
      BUYER: "Comprador",
      ADMINISTRATIVE: "Administrativo",
      WAITER: "Garçom",
      CASHIER: "Caixa",
    });
  });

  it("assertCan devolve true quando pode e diz qual ação foi negada quando não pode", () => {
    expect(assertCan(["CHEF"], "recipe.write")).toEqual({ ok: true, value: true });
    const r = assertCan(["WAITER"], "tab.pay");
    expect(r.ok ? null : [r.error.code, r.error.details]).toEqual(["FORBIDDEN", { action: "tab.pay" }]);
  });
});
