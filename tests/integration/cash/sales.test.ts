import { describe, it, expect } from "vitest";
import { ownerTestDb, testEnv } from "../harness";
import { code, unwrap } from "../ordering/fixtures";
import { cashScenario, money } from "./fixtures";
import { salesReport } from "../../../src/application/cash/sales";
import { cancelOrder } from "../../../src/application/ordering/kitchen";

const DAY = "2026-10-31";
const db = () => ownerTestDb().$client;

/** O dia do teste independente da US6: 3 X-Burger (um com 2 fatias de queijo), 2 Sucos, 1 cancelado. */
async function salesDay() {
  const env = testEnv();
  const s = await cashScenario(env);
  const sessionId = await s.openSession();
  const a = await s.served("12", [s.burger(2), s.juice(2)]);
  const b = await s.served("4", [s.burger(1, 2)]);
  const cancelled = await s.place("4", [s.burger(1)]);
  unwrap(
    await cancelOrder(env.deps, s.chef, {
      id: cancelled.orderId,
      reason: "CUSTOMER_GAVE_UP",
      note: null,
      version: 1,
      ingredientsUsed: false,
    }),
  );
  unwrap(await s.pay(a.tabId, "CASH", "78.00", "100.00"));
  unwrap(await s.pay(b.tabId, "PIX", "34.00"));
  unwrap(await s.closeTabOf(b.tabId));
  return { env, s, sessionId, a, b };
}

describe("relatório de vendas por período (spec 014, US6 e FR-007)", () => {
  it("produtos do mais vendido para o menos, adicionais à parte e o cancelado fora", async () => {
    const { env, s } = await salesDay();
    const r = unwrap(await salesReport(env.deps, s.m, { from: DAY, to: DAY }));
    expect(r.products.map((p) => [p.name, p.quantity, money(p.amount), p.share.toFixed(1)])).toEqual([
      ["X-Burger", 3, "94.00", "83.9"],
      ["Suco", 2, "18.00", "16.1"],
    ]);
    expect(r.products[0]!.recipeId).toBe(s.k.burger);
    expect(money(r.productsTotal)).toBe("112.00");
    expect(r.addons.map((x) => [x.addonId, x.name, x.times, money(x.amount)])).toEqual([
      [s.cheese, "Fatia de queijo", 2, "4.00"],
    ]);
  });

  it("Σ produtos = Σ dos pedidos não cancelados do período, centavo por centavo (SC-006)", async () => {
    const { env, s } = await salesDay();
    const r = unwrap(await salesReport(env.deps, s.m, { from: DAY, to: DAY }));
    const total = (
      await db().query(
        "select sum(total)::text as t from orders where restaurant_id = $1 and status <> 'CANCELLED' and business_day = $2",
        [s.m.restaurantId, DAY],
      )
    ).rows[0].t as string;
    expect(money(r.productsTotal)).toBe(total);
  });

  it("recebido por forma = soma dos turnos do período; taxa das contas fechadas no período", async () => {
    const { env, s } = await salesDay();
    await db().query(
      "update table_tabs set service_charge = 3.40, total = subtotal + 3.40 where status = 'CLOSED'",
    );
    const r = unwrap(await salesReport(env.deps, s.m, { from: DAY, to: DAY }));
    expect(r.byMethod.map((x) => [x.method, money(x.amount)])).toEqual([
      ["CASH", "78.00"],
      ["PIX", "34.00"],
      ["DEBIT_CARD", "0.00"],
      ["CREDIT_CARD", "0.00"],
      ["OTHER", "0.00"],
    ]);
    expect(money(r.received)).toBe("112.00");
    expect(r.removedFromOtherSessions).toEqual([]);
    expect(money(r.serviceCharge)).toBe("3.40");
  });

  it("turnos do período com a diferença e a soma das diferenças", async () => {
    const { env, s, sessionId } = await salesDay();
    // esperado = 150 + 78 = 228; contou 226 → falta 2
    unwrap(await s.closeSession(sessionId, "226.00", { note: "Troco errado" }));
    const second = await s.openSession("226.00", s.bruno);
    unwrap(await s.closeSession(second, "229.00", { note: "Sobrou", by: s.bruno }));
    await s.openSession("229.00");
    const r = unwrap(await salesReport(env.deps, s.m, { from: DAY, to: DAY }));
    expect(r.sessions.map((x) => [x.status, money(x.difference), x.result])).toEqual([
      ["OPEN", null, null],
      ["CLOSED", "3.00", "OVER"],
      ["CLOSED", "-2.00", "SHORT"],
    ]);
    expect(money(r.differenceTotal)).toBe("1.00");
  });

  it("pedidos ainda não entregues contam nas vendas e são avisados", async () => {
    const { env, s } = await salesDay();
    await s.place("12", [s.juice(1)]);
    const r = unwrap(await salesReport(env.deps, s.m, { from: DAY, to: DAY }));
    expect(r.pendingOrders).toBe(1);
    expect(r.products.find((p) => p.name === "Suco")?.quantity).toBe(3);
  });

  it("período vazio: tudo zero, sem divisão por zero", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const r = unwrap(await salesReport(env.deps, s.m, { from: "2026-10-01", to: "2026-10-02" }));
    expect(r.products).toEqual([]);
    expect(r.addons).toEqual([]);
    expect(r.sessions).toEqual([]);
    expect(money(r.received)).toBe("0.00");
    expect(money(r.productsTotal)).toBe("0.00");
    expect(money(r.serviceCharge)).toBe("0.00");
    expect(money(r.differenceTotal)).toBe("0.00");
    expect(r.pendingOrders).toBe(0);
  });

  it("só o gerente; período de 32 dias recusado; nada de outro restaurante", async () => {
    const { env, s } = await salesDay();
    expect(code(await salesReport(env.deps, s.ana, { from: DAY, to: DAY }))).toBe("FORBIDDEN");
    expect(code(await salesReport(env.deps, s.m, { from: "2026-10-01", to: "2026-11-01" }))).toBe(
      "INVALID_PERIOD",
    );
    const other = await cashScenario(env, "Restaurante Outro");
    const r = unwrap(await salesReport(env.deps, other.m, { from: DAY, to: DAY }));
    expect(r.products).toEqual([]);
    expect(r.sessions).toEqual([]);
  });
});
