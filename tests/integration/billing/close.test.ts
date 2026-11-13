import { describe, it, expect } from "vitest";
import { ownerTestDb, testEnv, type TestEnv } from "../harness";
import { code, scan, unwrap } from "../ordering/fixtures";
import { billingScenario } from "./fixtures";
import { closeTab, getTab, listOpenTabs } from "../../../src/application/billing/tabs";
import { addPayment } from "../../../src/application/billing/payments";
import { cancelOrder } from "../../../src/application/ordering/kitchen";
import { submitOrder } from "../../../src/application/ordering/submit-order";
import { getMenu } from "../../../src/application/ordering/menu";
import { businessDay } from "../../../src/domain/ordering/business-day";
import { MENU_ACCESS_MINUTES } from "../../../src/domain/ordering/menu-access";
import { d } from "../../../src/domain/shared/decimal";

/** Spec 011, US2-5 a US2-8 e FR-005/FR-006: fechar a conta e liberar a mesa. */

const db = () => ownerTestDb().$client;
const money = (v: { toFixed(n: number): string } | null | undefined) => v?.toFixed(2) ?? null;

/** Mesa 12: 2 × X-Burger + Suco entregues (R$ 84,70 com a taxa). `pay` paga o que falta em Pix. */
async function setup(env: TestEnv) {
  const b = await billingScenario(env);
  const burgers = await b.s.place([b.s.burger(2)]);
  const juice = await b.s.place([b.s.juice()]);
  await b.deliver(burgers.orderId);
  await b.deliver(juice.orderId);
  const id = await b.tabId();
  const pay = async (amount = "84.70") =>
    unwrap(
      await addPayment(env.deps, b.cashier, {
        tabId: id,
        method: "PIX",
        amount: d(amount),
        received: null,
        clientRequestId: crypto.randomUUID(),
      }),
    );
  const version = async () => unwrap(await getTab(env.deps, b.cashier, id)).version;
  return { ...b, id, burgers, juice, pay, version };
}

describe("fechar a conta (spec 011, US2-5)", () => {
  it("falta zero e tudo entregue: grava os valores, quem e quando, e a mesa sai do caixa", async () => {
    const env = testEnv();
    const t = await setup(env);
    await t.pay();
    env.clock.advance(60_000);
    unwrap(await closeTab(env.deps, t.cashier, { tabId: t.id, version: await t.version() }));

    const tab = unwrap(await getTab(env.deps, t.cashier, t.id));
    expect([tab.status, tab.closedAt, tab.closedByName, tab.canClose]).toEqual([
      "CLOSED",
      env.clock.now(),
      "Caixa Carla",
      false,
    ]);
    const row = await db().query(
      "select closed_day::text as day, subtotal::text, service_charge::text, total::text from table_tabs where id = $1",
      [t.id],
    );
    expect(row.rows[0]).toEqual({
      day: businessDay(env.clock.now(), "America/Sao_Paulo"),
      subtotal: "77.00",
      service_charge: "7.70",
      total: "84.70",
    });
    const closed = tab.events.find((e) => e.kind === "CLOSED");
    expect([closed?.userName, closed?.details]).toEqual([
      "Caixa Carla",
      { subtotal: "77.00", serviceCharge: "7.70", total: "84.70", paid: "84.70" },
    ]);
    expect(unwrap(await listOpenTabs(env.deps, t.cashier)).tabs).toEqual([]);
    const audit = await db().query(
      "select changes from audit_log where entity = 'table_tab' and entity_id = $1 and changes ? 'status'",
      [t.id],
    );
    expect(audit.rows.map((r) => r.changes)).toEqual([{ status: ["OPEN", "CLOSED"] }]);
  });

  it("ainda falta pagar: recusa e diz quanto", async () => {
    const env = testEnv();
    const t = await setup(env);
    await t.pay("50.00");
    const r = await closeTab(env.deps, t.cashier, { tabId: t.id, version: await t.version() });
    expect(r.ok ? null : [r.error.code, r.error.details]).toEqual([
      "REMAINING_NOT_ZERO",
      { remaining: "34.70" },
    ]);
    expect(unwrap(await getTab(env.deps, t.cashier, t.id)).status).toBe("OPEN");
  });

  it("pedido ainda não entregue: recusa e diz quantos", async () => {
    const env = testEnv();
    const t = await setup(env);
    await t.s.place([t.s.juice()]);
    await t.pay("94.60");
    const r = await closeTab(env.deps, t.cashier, { tabId: t.id, version: await t.version() });
    expect(r.ok ? null : [r.error.code, r.error.details]).toEqual(["PENDING_ORDERS", { pending: 1 }]);
  });

  it("pedido que entrou depois da tela carregada: 'a conta mudou'", async () => {
    const env = testEnv();
    const t = await setup(env);
    await t.pay();
    const seen = await t.version();
    await t.s.place([t.s.juice()]);
    expect(code(await closeTab(env.deps, t.cashier, { tabId: t.id, version: seen }))).toBe("STALE_RECORD");
  });

  it("conta com todos os pedidos cancelados (total zero) fecha sem pagamento", async () => {
    const env = testEnv();
    const b = await billingScenario(env);
    const only = await b.s.place([b.s.juice()]);
    unwrap(
      await cancelOrder(env.deps, b.chef, {
        id: only.orderId,
        reason: "CUSTOMER_GAVE_UP",
        note: null,
        version: 1,
      }),
    );
    const id = await b.tabId();
    const version = unwrap(await getTab(env.deps, b.cashier, id)).version;
    unwrap(await closeTab(env.deps, b.cashier, { tabId: id, version }));
    expect(money(unwrap(await getTab(env.deps, b.cashier, id)).total)).toBe("0.00");
  });

  it("fechar de novo é recusado; garçom não fecha", async () => {
    const env = testEnv();
    const t = await setup(env);
    await t.pay();
    const version = await t.version();
    expect(code(await closeTab(env.deps, t.waiter, { tabId: t.id, version }))).toBe("FORBIDDEN");
    unwrap(await closeTab(env.deps, t.m, { tabId: t.id, version }));
    expect(code(await closeTab(env.deps, t.cashier, { tabId: t.id, version: version + 1 }))).toBe(
      "TAB_CLOSED",
    );
  });

  it("mesa inativada com a conta aberta ainda fecha", async () => {
    const env = testEnv();
    const t = await setup(env);
    await t.pay();
    await db().query("update dining_tables set active = false where id = $1", [t.s.table.tableId]);
    unwrap(await closeTab(env.deps, t.cashier, { tabId: t.id, version: await t.version() }));
  });
});

describe("mesa liberada (spec 011, US2-6 a US2-8)", () => {
  it("o próximo pedido pelo QR code da mesa abre uma conta nova, vazia", async () => {
    const env = testEnv();
    const t = await setup(env);
    await t.pay();
    unwrap(await closeTab(env.deps, t.cashier, { tabId: t.id, version: await t.version() }));

    env.clock.advance(5 * 60_000);
    const phone = await scan(env, t.s.table.token);
    const next = unwrap(
      await submitOrder(env.deps, phone, { clientRequestId: crypto.randomUUID(), lines: [t.s.juice()] }),
    );
    const newTab = await t.tabId();
    expect(newTab).not.toBe(t.id);
    const tab = unwrap(await getTab(env.deps, t.cashier, newTab));
    expect([tab.orders.map((o) => o.id), money(tab.paid), tab.status]).toEqual([
      [next.orderId],
      "0.00",
      "OPEN",
    ]);
    const old = unwrap(await getTab(env.deps, t.cashier, t.id));
    expect([old.status, money(old.total), old.orders]).toEqual(["CLOSED", "84.70", expect.any(Array)]);
    expect(old.orders).toHaveLength(2);
  });

  it("os celulares da mesa fechada não pedem mais: o cardápio avisa que a conta foi fechada", async () => {
    const env = testEnv();
    const t = await setup(env);
    const other = await t.placeAt("13", [t.s.juice()]);
    const secondPhone = await scan(env, t.s.table.token);
    await t.pay();
    unwrap(await closeTab(env.deps, t.cashier, { tabId: t.id, version: await t.version() }));

    for (const cookie of [t.s.cookie, secondPhone]) {
      expect(code(await getMenu(env.deps, cookie))).toBe("TABLE_TAB_CLOSED");
      expect(
        code(
          await submitOrder(env.deps, cookie, { clientRequestId: crypto.randomUUID(), lines: [t.s.juice()] }),
        ),
      ).toBe("TABLE_TAB_CLOSED");
    }
    const ended = await db().query(
      "select end_reason, count(*)::int as n from menu_accesses where table_id = $1 group by end_reason",
      [t.s.table.tableId],
    );
    expect(ended.rows).toEqual([{ end_reason: "TAB_CLOSED", n: 2 }]);
    expect(unwrap(await getMenu(env.deps, other.cookie)).tableName).toBe("13");
  });

  it("acesso que já tinha vencido não muda de motivo", async () => {
    const env = testEnv();
    const t = await setup(env);
    await t.pay();
    env.clock.advance((MENU_ACCESS_MINUTES + 1) * 60_000);
    unwrap(await closeTab(env.deps, t.cashier, { tabId: t.id, version: await t.version() }));
    const r = await db().query("select end_reason from menu_accesses where table_id = $1", [
      t.s.table.tableId,
    ]);
    expect(r.rows).toEqual([{ end_reason: null }]);
    expect(code(await getMenu(env.deps, t.s.cookie))).toBe("ACCESS_EXPIRED");
  });
});
