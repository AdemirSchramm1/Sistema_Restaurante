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
import { listSuppliers } from "../../../src/application/suppliers/suppliers";

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
});
