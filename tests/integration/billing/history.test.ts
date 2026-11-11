import { describe, it, expect } from "vitest";
import { ownerTestDb, testEnv, type TestEnv } from "../harness";
import { code, scan, unwrap } from "../ordering/fixtures";
import { billingScenario } from "./fixtures";
import { closeTab, getTab, listOpenTabs, listTabs, reopenTab } from "../../../src/application/billing/tabs";
import { addPayment, removePayment } from "../../../src/application/billing/payments";
import { submitOrder } from "../../../src/application/ordering/submit-order";
import type { PaymentMethod } from "../../../src/domain/billing/payment";
import { d } from "../../../src/domain/shared/decimal";

/** Spec 011, US6 e FR-009/FR-010: contas fechadas por período e reabrir (gerente). */

const db = () => ownerTestDb().$client;
const money = (v: { toFixed(n: number): string }) => v.toFixed(2);
type Scenario = Awaited<ReturnType<typeof billingScenario>>;

async function pay(env: TestEnv, b: Scenario, tabId: string, method: PaymentMethod, amount: string) {
  return unwrap(
    await addPayment(env.deps, b.cashier, {
      tabId,
      method,
      amount: d(amount),
      received: null,
      clientRequestId: crypto.randomUUID(),
    }),
  ).paymentId;
}

/** Entrega os pedidos da conta, paga o que falta (como `payments` manda) e fecha. */
async function settle(env: TestEnv, b: Scenario, tabId: string, orderIds: string[], payments: [PaymentMethod, string][]) {
  for (const id of orderIds) await b.deliver(id);
  for (const [method, amount] of payments) await pay(env, b, tabId, method, amount);
  const version = unwrap(await getTab(env.deps, b.cashier, tabId)).version;
  unwrap(await closeTab(env.deps, b.cashier, { tabId, version }));
}

/** Mesa 12 (R$ 84,70: Pix 50,00 + Dinheiro 34,70, com um Pix de 10,00 tirado) e mesa 13 (R$ 9,90 no crédito). */
async function twoClosedTabs(env: TestEnv) {
  const b = await billingScenario(env);
  const burgers = await b.s.place([b.s.burger(2)]);
  const juice = await b.s.place([b.s.juice()]);
  const t12 = await b.tabId();
  const wrong = await pay(env, b, t12, "PIX", "10.00");
  unwrap(await removePayment(env.deps, b.cashier, { tabId: t12, paymentId: wrong }));
  await settle(env, b, t12, [burgers.orderId, juice.orderId], [
    ["PIX", "50.00"],
    ["CASH", "34.70"],
  ]);
  env.clock.advance(30 * 60_000);
  const other = await b.placeAt("13", [b.s.juice()]);
  await settle(env, b, other.tabId, [other.orderId], [["CREDIT_CARD", "9.90"]]);
  const today = (await db().query("select closed_day::text as day from table_tabs where id = $1", [t12])).rows[0]
    .day as string;
  return { ...b, t12, t13: other.tabId, table13: other.tableId, today };
}

describe("contas fechadas (spec 011, US6)", () => {
  it("lista as contas do período, a mais recente primeiro, com mesa, quem fechou e os valores", async () => {
    const env = testEnv();
    const t = await twoClosedTabs(env);
    const phone = await scan(env, t.s.table.token);
    unwrap(await submitOrder(env.deps, phone, { clientRequestId: crypto.randomUUID(), lines: [t.s.juice()] }));

    const r = unwrap(await listTabs(env.deps, t.cashier, { from: t.today, to: t.today }));
    expect(
      r.tabs.map((x) => [x.tableName, x.closedByName, money(x.subtotal), money(x.serviceCharge), money(x.total)]),
    ).toEqual([
      ["13", "Caixa Carla", "9.00", "0.90", "9.90"],
      ["12", "Caixa Carla", "77.00", "7.70", "84.70"],
    ]);
    expect(r.tabs[0]!.closedAt.getTime()).toBeGreaterThan(r.tabs[1]!.closedAt.getTime());
  });

  it("resumo por forma de pagamento sem os pagamentos tirados, com o total da taxa e o total", async () => {
    const env = testEnv();
    const t = await twoClosedTabs(env);
    const { summary } = unwrap(await listTabs(env.deps, t.m, { from: t.today, to: t.today }));
    expect(summary.byMethod.map((x) => [x.method, money(x.amount)])).toEqual([
      ["CASH", "34.70"],
      ["PIX", "50.00"],
      ["CREDIT_CARD", "9.90"],
    ]);
    expect([money(summary.serviceCharge), money(summary.total)]).toEqual(["8.60", "94.60"]);
  });

  it("filtra por mesa", async () => {
    const env = testEnv();
    const t = await twoClosedTabs(env);
    const r = unwrap(await listTabs(env.deps, t.cashier, { from: t.today, to: t.today, tableId: t.table13 }));
    expect(r.tabs.map((x) => x.tableName)).toEqual(["13"]);
    expect(r.summary.byMethod.map((x) => x.method)).toEqual(["CREDIT_CARD"]);
  });

  it("o dia da conta é o dia local do restaurante em que ela fechou", async () => {
    const env = testEnv();
    env.clock.current = new Date("2026-11-01T02:30:00Z");
    const b = await billingScenario(env);
    const o = await b.s.place([b.s.juice()]);
    await settle(env, b, await b.tabId(), [o.orderId], [["PIX", "9.90"]]);
    expect(unwrap(await listTabs(env.deps, b.cashier, { from: "2026-10-31", to: "2026-10-31" })).tabs).toHaveLength(1);
    expect(unwrap(await listTabs(env.deps, b.cashier, { from: "2026-11-01", to: "2026-11-01" })).tabs).toEqual([]);
  });

  it("período de até 31 dias, com o início antes do fim", async () => {
    const env = testEnv();
    const b = await billingScenario(env);
    expect(code(await listTabs(env.deps, b.cashier, { from: "2026-10-01", to: "2026-11-01" }))).toBe("INVALID_PERIOD");
    expect(code(await listTabs(env.deps, b.cashier, { from: "2026-11-02", to: "2026-11-01" }))).toBe("INVALID_PERIOD");
    expect(code(await listTabs(env.deps, b.cashier, { from: "ontem", to: "2026-11-01" }))).toBe("INVALID_PERIOD");
    unwrap(await listTabs(env.deps, b.cashier, { from: "2026-10-02", to: "2026-11-01" }));
  });

  it("garçom não vê as contas fechadas", async () => {
    const env = testEnv();
    const b = await billingScenario(env);
    expect(code(await listTabs(env.deps, b.waiter, { from: "2026-10-31", to: "2026-10-31" }))).toBe("FORBIDDEN");
  });
});

describe("reabrir conta (spec 011, US6)", () => {
  it("gerente reabre com motivo: volta aberta com os pagamentos e o histórico guarda os valores de antes", async () => {
    const env = testEnv();
    const t = await twoClosedTabs(env);
    const closed = unwrap(await getTab(env.deps, t.m, t.t12));
    env.clock.advance(60_000);
    unwrap(await reopenTab(env.deps, t.m, { tabId: t.t12, reason: "  Cliente pediu a conta em dois CPFs  ", version: closed.version }));

    const tab = unwrap(await getTab(env.deps, t.m, t.t12));
    expect([tab.status, tab.closedAt, tab.closedByName, money(tab.paid), money(tab.remaining)]).toEqual([
      "OPEN",
      null,
      null,
      "84.70",
      "0.00",
    ]);
    const event = tab.events.find((e) => e.kind === "REOPENED")!;
    expect([event.reason, event.userName, event.details]).toEqual([
      "Cliente pediu a conta em dois CPFs",
      "Gerente",
      {
        previous: {
          subtotal: "77.00",
          serviceCharge: "7.70",
          total: "84.70",
          closedAt: closed.closedAt!.toISOString(),
          closedByName: "Caixa Carla",
        },
      },
    ]);
    expect(unwrap(await listOpenTabs(env.deps, t.m)).tabs.map((x) => x.tableName)).toEqual(["12"]);
    expect(unwrap(await listTabs(env.deps, t.m, { from: t.today, to: t.today })).tabs.map((x) => x.tableName)).toEqual([
      "13",
    ]);
    const audit = await db().query(
      "select changes from audit_log where entity = 'table_tab' and entity_id = $1 and changes ? 'reason'",
      [t.t12],
    );
    expect(audit.rows.map((r) => r.changes)).toEqual([
      { status: ["CLOSED", "OPEN"], reason: "Cliente pediu a conta em dois CPFs" },
    ]);
  });

  it("motivo obrigatório, de até 140 letras", async () => {
    const env = testEnv();
    const t = await twoClosedTabs(env);
    const { version } = unwrap(await getTab(env.deps, t.m, t.t12));
    const empty = await reopenTab(env.deps, t.m, { tabId: t.t12, reason: "   ", version });
    expect(empty.ok ? null : [empty.error.code, empty.error.field]).toEqual(["REASON_REQUIRED", "reason"]);
    const long = await reopenTab(env.deps, t.m, { tabId: t.t12, reason: "x".repeat(141), version });
    expect(long.ok ? null : [long.error.code, long.error.field]).toEqual(["NOTE_TOO_LONG", "reason"]);
    unwrap(await reopenTab(env.deps, t.m, { tabId: t.t12, reason: "x".repeat(140), version }));
  });

  it("só o gerente reabre; conta aberta não reabre; versão antiga é recusada", async () => {
    const env = testEnv();
    const t = await twoClosedTabs(env);
    const { version } = unwrap(await getTab(env.deps, t.m, t.t12));
    expect(code(await reopenTab(env.deps, t.cashier, { tabId: t.t12, reason: "Erro", version }))).toBe("FORBIDDEN");
    expect(code(await reopenTab(env.deps, t.m, { tabId: t.t12, reason: "Erro", version: version - 1 }))).toBe(
      "STALE_RECORD",
    );
    unwrap(await reopenTab(env.deps, t.m, { tabId: t.t12, reason: "Erro", version }));
    expect(code(await reopenTab(env.deps, t.m, { tabId: t.t12, reason: "Erro", version: version + 1 }))).toBe(
      "TAB_NOT_CLOSED",
    );
  });

  it("mesa que já abriu outra conta: feche a nova antes", async () => {
    const env = testEnv();
    const t = await twoClosedTabs(env);
    const phone = await scan(env, t.s.table.token);
    unwrap(await submitOrder(env.deps, phone, { clientRequestId: crypto.randomUUID(), lines: [t.s.juice()] }));
    const { version } = unwrap(await getTab(env.deps, t.m, t.t12));
    expect(code(await reopenTab(env.deps, t.m, { tabId: t.t12, reason: "Erro", version }))).toBe("TABLE_HAS_OPEN_TAB");
    expect(unwrap(await getTab(env.deps, t.m, t.t12)).status).toBe("CLOSED");
  });
});
