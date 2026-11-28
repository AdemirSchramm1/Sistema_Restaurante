import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { testEnv, type TestEnv } from "../harness";
import { billingScenario } from "../billing/fixtures";
import { explainingEnv } from "./explain";
import { getMenu, listAccessOrders } from "../../../src/application/ordering/menu";
import {
  listDishesForKitchen,
  listKitchenOrders,
  listReadyOrders,
} from "../../../src/application/ordering/kitchen";
import { getOrder, listOrders } from "../../../src/application/ordering/orders";
import { listTables } from "../../../src/application/ordering/tables";
import { listAddons } from "../../../src/application/ordering/addons";
import { getProductCustomization } from "../../../src/application/ordering/customization";
import { getTab, listOpenTabs, listTabs } from "../../../src/application/billing/tabs";
import { listItems } from "../../../src/application/inventory/list-items";
import { listGroupTree } from "../../../src/application/inventory/list-group-tree";
import { listRecipes } from "../../../src/application/inventory/recipes";
import { getShellInfo } from "../../../src/application/shell";
import { searchAudit } from "../../../src/application/audit/search-audit";
import { listSuppliers } from "../../../src/application/suppliers/suppliers";
import { cashScenario } from "../cash/fixtures";
import { tablet, tableWithQr, unwrap } from "../ordering/fixtures";
import { tabletStatus } from "../../../src/application/ordering/menu-access";
import { listTabletStatus } from "../../../src/application/ordering/tablets";
import { getCurrentCashSession } from "../../../src/application/cash/sessions";
import { getCashClosing } from "../../../src/application/cash/closing";
import { getCashSessionReport, listCashSessions } from "../../../src/application/cash/reports";

/**
 * Spec 012, US4 cenário 4 e R2: as telas mais usadas consultam por índice. Nenhuma lê a tabela
 * inteira (de todos os restaurantes) para depois filtrar.
 */
describe("consultas das telas usam índice (spec 012, FR-008)", () => {
  let env: TestEnv;
  let explaining: ReturnType<typeof explainingEnv>;

  beforeEach(() => {
    env = testEnv();
    explaining = explainingEnv(env);
  });
  afterEach(async () => {
    await explaining.close();
  });

  it("cardápio, cozinha, garçom, caixa, conta, pedidos e cadastros sem leitura da tabela inteira", async () => {
    const b = await billingScenario(env);
    const sent = await b.s.place([b.s.burger(2), b.s.juice()]);
    await b.advance(sent.orderId, "PREPARING");
    const tabId = await b.tabId();
    const day = "2026-10-31";
    const { deps, fullScans, planCount } = explaining;
    expect(await explaining.currentRole()).toBe("app_user");

    const screens: Record<string, () => Promise<unknown>> = {
      "cardápio do cliente": () => getMenu(deps, b.s.cookie),
      "meus pedidos": () => listAccessOrders(deps, b.s.cookie),
      cozinha: () => listKitchenOrders(deps, b.chef),
      "esgotado hoje": () => listDishesForKitchen(deps, b.chef),
      garçom: () => listReadyOrders(deps, b.waiter),
      caixa: () => listOpenTabs(deps, b.cashier),
      "conta da mesa": () => getTab(deps, b.cashier, tabId),
      "contas fechadas": () => listTabs(deps, b.cashier, { from: day, to: day }),
      pedidos: () => listOrders(deps, b.m, { from: day, to: day }),
      "detalhe do pedido": () => getOrder(deps, b.m, sent.orderId),
      itens: () => listItems(deps, b.m, { page: 1, status: "all" }),
      "busca de itens": () => listItems(deps, b.m, { page: 1, q: "queijo" }),
      grupos: () => listGroupTree(deps, b.m),
      produtos: () => listRecipes(deps, b.m, { status: "all" }),
      "opções do produto": () => getProductCustomization(deps, b.m, b.s.burgerId),
      fornecedores: () => listSuppliers(deps, b.m, { status: "all" }),
      mesas: () => listTables(deps, b.m, { includeInactive: true }),
      adicionais: () => listAddons(deps, b.m, { includeInactive: true }),
      "cabeçalho (nome e Repor)": () => getShellInfo(deps, b.m),
      auditoria: () => searchAudit(deps, b.m, { de: day, ate: day }),
      "auditoria por pessoa e tipo": () =>
        searchAudit(deps, b.m, { de: day, ate: day, pessoa: b.m.userId, tipo: "ORDERS" }),
      "auditoria só negadas": () => searchAudit(deps, b.m, { de: day, ate: day, negadas: "1" }),
    };

    const problems: string[] = [];
    for (const [screen, load] of Object.entries(screens)) {
      fullScans();
      const r = (await load()) as { ok: boolean };
      expect(r.ok, screen).toBe(true);
      expect(planCount(), `${screen}: nenhum plano capturado`).toBeGreaterThan(0);
      problems.push(...fullScans().map((s) => `${screen}: ${s}`));
    }
    expect(problems).toEqual([]);
  });

  it("tablet da mesa: checagem, cardápio, pedidos da conta e a tela Mesas por índice (spec 016)", async () => {
    const b = await billingScenario(env);
    for (let i = 1; i <= 5; i++) await tableWithQr(env, b.m, `T${i}`);
    const cookie = await tablet(env, b.m, b.s.table.tableId);
    await b.s.place([b.s.juice()]);
    const { deps, fullScans, planCount } = explaining;
    const screens: Record<string, () => Promise<unknown>> = {
      "checagem do tablet": async () => ({ ok: (await tabletStatus(deps, cookie)) !== null }),
      "cardápio do tablet": () => getMenu(deps, { qr: null, tablet: cookie }),
      "pedidos enviados do tablet": () => listAccessOrders(deps, { qr: null, tablet: cookie }),
      "tablets da tela Mesas": () => listTabletStatus(deps, b.m),
    };
    const problems: string[] = [];
    for (const [screen, load] of Object.entries(screens)) {
      fullScans();
      const r = (await load()) as { ok: boolean };
      expect(r.ok, screen).toBe(true);
      expect(planCount(), `${screen}: nenhum plano capturado`).toBeGreaterThan(0);
      problems.push(...fullScans().map((x) => `${screen}: ${x}`));
    }
    expect(problems).toEqual([]);
  });

  it("a tela Cardápio lê os produtos por seção e posição pelo índice recipes_menu_order (spec 013)", async () => {
    const b = await billingScenario(env);
    const { deps, fullScans, usedIndexes } = explaining;
    fullScans();
    const r = await deps.tenant(b.m.restaurantId, async (repos) => ({
      ok: true as const,
      value: await repos.menuBoard.products(),
    }));
    expect(r.ok && r.value.length).toBe(2);
    expect(usedIndexes()).toContain("recipes_menu_order");
    expect(fullScans()).toEqual([]);
  });

  it("caixa do dia: turno aberto, último fechado, somas por turno, contagens e lista de turnos por índice (spec 014)", async () => {
    const c = await cashScenario(env);
    const first = await c.specShift();
    unwrap(await c.closeTabOf(first.tabId));
    unwrap(await c.closeSession(first.sessionId, "127.00", { kept: "100.00" }));
    const CASH_TABLES = [
      "cash_sessions",
      "cash_entries",
      "cash_counts",
      "table_tabs",
      "tab_payments",
      "tab_payment_removals",
    ];
    await explaining.analyze(...CASH_TABLES);
    const { deps, fullScans, planCount, usedIndexes } = explaining;
    const day = "2026-10-31";

    const problems: string[] = [];
    const indexes = new Set<string>();
    const check = async (screens: Record<string, () => Promise<unknown>>) => {
      for (const [screen, load] of Object.entries(screens)) {
        fullScans();
        const r = (await load()) as { ok: boolean };
        expect(r.ok, screen).toBe(true);
        expect(planCount(), `${screen}: nenhum plano capturado`).toBeGreaterThan(0);
        for (const index of usedIndexes()) indexes.add(index);
        problems.push(...fullScans().map((s) => `${screen}: ${s}`));
      }
    };
    await check({
      "caixa fechado (último turno fechado)": () => getCurrentCashSession(deps, c.ana),
      "relatório do turno fechado": () => getCashSessionReport(deps, c.m, first.sessionId),
      "lista de turnos": () => listCashSessions(deps, c.m, { from: day, to: day }),
    });

    const second = await c.openSession("100.00");
    unwrap(await c.count(second, "100.00"));
    await explaining.analyze(...CASH_TABLES);
    await check({
      "caixa aberto": () => getCurrentCashSession(deps, c.m),
      "fechar caixa": () => getCashClosing(deps, c.ana),
      "relatório do turno aberto": () => getCashSessionReport(deps, c.m, second),
    });
    expect(problems).toEqual([]);
    const expected = [
      "cash_sessions_one_open",
      "cash_sessions_day",
      "cash_entries_client_request",
      "cash_counts_session",
      "tab_payments_cash_session",
      // Pagamento tirado é raro: com estatísticas reais o PostgreSQL parte dos pagamentos do turno e
      // acha o tirado pelo índice do pagamento (o índice do turno serve quando há muitos tirados).
      "tab_payment_removals_payment",
      "table_tabs_cash_session",
    ];
    expect(
      expected.filter((i) => !indexes.has(i)),
      `índices usados: ${[...indexes].sort().join(", ")}`,
    ).toEqual([]);
  });
});
