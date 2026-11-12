import { describe, it, expect } from "vitest";
import { ownerTestDb, testEnv } from "../harness";
import { code, unwrap } from "../ordering/fixtures";
import { billingScenario } from "./fixtures";
import { cancelOrder } from "../../../src/application/ordering/kitchen";
import { getTab, listOpenTabs } from "../../../src/application/billing/tabs";

/** Spec 011, US1: o caixa vê as mesas com conta aberta e a conta de cada uma. */

const money = (v: { toFixed(n: number): string }) => v.toFixed(2);

describe("caixa: contas abertas e a conta da mesa (spec 011, US1)", () => {
  it("lista as mesas com conta aberta: total com a taxa, há quanto tempo e pedidos não entregues", async () => {
    const env = testEnv();
    const b = await billingScenario(env);
    const first = await b.s.place([b.s.burger(2)]);
    env.clock.advance(5 * 60_000);
    await b.s.place([b.s.juice()]);
    await b.deliver(first.orderId);
    env.clock.advance(30 * 60_000);

    const r = unwrap(await listOpenTabs(env.deps, b.cashier));
    expect(r.serverNow).toBe(env.clock.now().toISOString());
    expect(
      r.tabs.map((t) => ({
        table: t.tableName,
        total: money(t.total),
        remaining: money(t.remaining),
        pending: t.pendingOrders,
        openedAt: t.openedAt.toISOString(),
      })),
    ).toEqual([
      {
        table: "12",
        total: "84.70",
        remaining: "84.70",
        pending: 1,
        openedAt: new Date(env.clock.now().getTime() - 35 * 60_000).toISOString(),
      },
    ]);
  });

  it("a conta tem as linhas com as mudanças, o cancelado riscado com o motivo, a taxa, o total e o que falta", async () => {
    const env = testEnv();
    const b = await billingScenario(env);
    const burgers = await b.s.place([b.s.burger(2)]);
    const juice = await b.s.place([b.s.juice()]);
    const extra = await b.s.place([b.s.juice()]);
    await b.deliver(burgers.orderId);
    unwrap(
      await cancelOrder(env.deps, b.chef, {
        id: extra.orderId,
        reason: "CUSTOMER_GAVE_UP",
        note: null,
        version: 1,
      }),
    );

    const tab = unwrap(await getTab(env.deps, b.cashier, await b.tabId()));
    expect(tab.tableName).toBe("12");
    expect(tab.status).toBe("OPEN");
    expect(
      tab.orders.map((o) => ({
        number: o.number,
        status: o.status,
        cancelReason: o.cancelReason,
        total: money(o.total),
      })),
    ).toEqual([
      { number: burgers.number, status: "DELIVERED", cancelReason: null, total: "68.00" },
      { number: juice.number, status: "RECEIVED", cancelReason: null, total: "9.00" },
      { number: extra.number, status: "CANCELLED", cancelReason: "CUSTOMER_GAVE_UP", total: "9.00" },
    ]);
    expect(tab.orders[0]!.lines).toEqual([
      {
        quantity: 2,
        productName: "X-Burger",
        unitPrice: expect.anything(),
        changes: ["+ 2 Fatia de queijo", "SEM cebola"],
      },
    ]);
    expect({
      subtotal: money(tab.subtotal),
      rate: tab.serviceRate?.toString(),
      service: money(tab.serviceCharge),
      total: money(tab.total),
      paid: money(tab.paid),
      remaining: money(tab.remaining),
    }).toEqual({
      subtotal: "77.00",
      rate: "10",
      service: "7.70",
      total: "84.70",
      paid: "0.00",
      remaining: "84.70",
    });
    expect(tab.pendingOrders).toBe(1);
    expect(tab.canClose).toBe(false);
    expect(tab.blockers).toEqual(["REMAINING_NOT_ZERO", "PENDING_ORDERS"]);
    expect(tab.payments).toEqual([]);
    expect(tab.events.map((e) => e.kind)).toEqual(["OPENED"]);
    expect(tab.restaurantName).toBe("Restaurante Sabor");
  });

  it("garçom vê a conta; estoquista não vê e a tentativa fica na auditoria", async () => {
    const env = testEnv();
    const b = await billingScenario(env);
    await b.s.place([b.s.juice()]);
    const id = await b.tabId();
    expect(code(await getTab(env.deps, b.waiter, id))).toBe("OK");
    expect(code(await listOpenTabs(env.deps, b.waiter))).toBe("OK");
    expect(code(await listOpenTabs(env.deps, b.stockkeeper))).toBe("FORBIDDEN");
    expect(code(await getTab(env.deps, b.stockkeeper, id))).toBe("FORBIDDEN");
    const denied = await ownerTestDb().$client.query(
      "select count(*)::int as n from audit_log where action = 'DENIED' and user_id = $1 and entity = 'table_tab'",
      [b.stockkeeper.userId],
    );
    expect(denied.rows[0].n).toBe(2);
  });

  it("conta de outro restaurante não existe aqui", async () => {
    const env = testEnv();
    const b = await billingScenario(env);
    const other = await billingScenario(env);
    await other.s.place([other.s.juice()]);
    expect(code(await getTab(env.deps, b.cashier, await other.tabId()))).toBe("NOT_FOUND");
    expect(unwrap(await listOpenTabs(env.deps, b.cashier)).tabs).toEqual([]);
  });
});
