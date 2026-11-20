import { describe, it, expect } from "vitest";
import { ownerTestDb, testEnv } from "../harness";
import { code, unwrap } from "../ordering/fixtures";
import { cashScenario, money } from "./fixtures";
import { getTab, listOpenTabs, reopenTab } from "../../../src/application/billing/tabs";
import { getCashSessionReport } from "../../../src/application/cash/reports";

/** Spec 014, US2 e FR-002: todo pagamento entra no turno aberto. */

const db = () => ownerTestDb().$client;
const count = async (table: string) =>
  (await db().query(`select count(*)::int as n from ${table}`)).rows[0].n;

describe("pagamento dentro do turno (spec 014, US2)", () => {
  it("sem caixa aberto, lançar e tirar pagamento são recusados e nada é gravado", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const order = await s.served("12", [s.juice()]);
    const refused = await s.pay(order.tabId, "PIX", "9.00");
    expect(code(refused)).toBe("CASH_SESSION_REQUIRED");
    expect(await count("tab_payments")).toBe(0);
    expect(unwrap(await getTab(env.deps, s.ana, order.tabId)).cashSessionOpen).toBe(false);
    expect(unwrap(await listOpenTabs(env.deps, s.ana)).cashSessionOpen).toBe(false);

    const first = await s.openSession();
    const paid = unwrap(await s.pay(order.tabId, "PIX", "9.00"));
    unwrap(await s.closeSession(first, "150.00"));
    const removal = await s.unpay(order.tabId, paid.paymentId);
    expect(code(removal)).toBe("CASH_SESSION_REQUIRED");
    expect(!removal.ok && removal.error.details).toEqual({ action: "remove" });
    expect(await count("tab_payment_removals")).toBe(0);
  });

  it("com o caixa aberto, o pagamento e a remoção guardam o turno e somam 1 na versão dele", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const sessionId = await s.openSession();
    const order = await s.served("12", [s.burger(3), s.juice(3)]);
    expect(unwrap(await getTab(env.deps, s.ana, order.tabId)).cashSessionOpen).toBe(true);
    expect(unwrap(await listOpenTabs(env.deps, s.waiter)).cashSessionOpen).toBe(true);

    const cash = unwrap(await s.pay(order.tabId, "CASH", "77.00", "100.00"));
    expect(money(cash.change)).toBe("23.00");
    expect((await s.sessionRow(sessionId)).version).toBe(2);
    unwrap(await s.unpay(order.tabId, cash.paymentId));
    expect((await s.sessionRow(sessionId)).version).toBe(3);

    const payment = await db().query("select cash_session_id from tab_payments where id = $1", [
      cash.paymentId,
    ]);
    const removal = await db().query(
      "select cash_session_id from tab_payment_removals where payment_id = $1",
      [cash.paymentId],
    );
    expect([payment.rows[0].cash_session_id, removal.rows[0].cash_session_id]).toEqual([
      sessionId,
      sessionId,
    ]);
    const events = unwrap(await getTab(env.deps, s.ana, order.tabId)).events;
    expect(events.filter((e) => e.kind !== "OPENED").map((e) => [e.kind, e.details?.cashSessionId])).toEqual([
      ["PAYMENT_ADDED", sessionId],
      ["PAYMENT_REMOVED", sessionId],
    ]);
    const audit = await db().query(
      "select changes from audit_log where entity = 'table_tab' and action = 'UPDATE' order by occurred_at, id",
    );
    expect(audit.rows.map((r) => (r.changes.paymentAdded ?? r.changes.paymentRemoved).cashSessionId)).toEqual(
      [sessionId, sessionId],
    );
  });

  it("toque duplo no pagamento devolve o mesmo, mesmo depois de o caixa fechar", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const sessionId = await s.openSession();
    const order = await s.served("12", [s.juice()]);
    const { addPayment } = await import("../../../src/application/billing/payments");
    const { d } = await import("../../../src/domain/shared/decimal");
    const input = {
      tabId: order.tabId,
      method: "PIX" as const,
      amount: d("9.00"),
      received: null,
      clientRequestId: crypto.randomUUID(),
    };
    const first = unwrap(await addPayment(env.deps, s.ana, input));
    unwrap(await s.closeSession(sessionId, "150.00"));
    expect(unwrap(await addPayment(env.deps, s.ana, input)).paymentId).toBe(first.paymentId);
    expect(await count("tab_payments")).toBe(1);
  });

  it("pagamento do turno A tirado no turno B sai do turno B e não muda o recebido de A", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const a = await s.openSession();
    const order = await s.served("4", [s.burger()]);
    const pix = unwrap(await s.pay(order.tabId, "PIX", "30.00"));
    unwrap(await s.closeTabOf(order.tabId));
    unwrap(await s.closeSession(a, "150.00"));

    const b = await s.openSession("150.00");
    const tab = unwrap(await getTab(env.deps, s.m, order.tabId));
    unwrap(
      await reopenTab(env.deps, s.m, { tabId: order.tabId, reason: "Era dinheiro", version: tab.version }),
    );
    unwrap(await s.unpay(order.tabId, pix.paymentId, s.m));
    unwrap(await s.pay(order.tabId, "CASH", "30.00", null, s.m));

    const reportA = unwrap(await getCashSessionReport(env.deps, s.m, a));
    expect(
      reportA.receivedByMethod.filter((r) => !r.amount.isZero()).map((r) => [r.method, money(r.amount)]),
    ).toEqual([["PIX", "30.00"]]);
    expect(reportA.removedFromOtherSessions).toEqual([]);
    const reportB = unwrap(await getCashSessionReport(env.deps, s.m, b));
    expect(reportB.removedFromOtherSessions.map((r) => [r.method, money(r.amount)])).toEqual([
      ["PIX", "30.00"],
    ]);
    expect(
      reportB.receivedByMethod.filter((r) => !r.amount.isZero()).map((r) => [r.method, money(r.amount)]),
    ).toEqual([["CASH", "30.00"]]);
    expect(money(reportB.expected)).toBe("180.00");
  });

  it("pagamento em dinheiro de antes da 014 (sem turno) tirado num turno também sai do esperado dele", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const order = await s.served("4", [s.burger()]);
    // Linha de antes da 014: entra pelo dono, com a checagem desligada só nesta transação.
    const c = await db().connect();
    const old = env.deps.ids.next();
    try {
      await c.query("begin");
      await c.query("alter table tab_payments drop constraint tab_payments_cash_session");
      await c.query(
        `insert into tab_payments (id, restaurant_id, created_at, created_by, tab_id, method, amount, received, change, client_request_id)
         values ($1, $2, now(), $3, $4, 'CASH', 30, 30, 0, $1)`,
        [old, s.m.restaurantId, s.ana.userId, order.tabId],
      );
      await c.query(
        "alter table tab_payments add constraint tab_payments_cash_session check (cash_session_id is not null) not valid",
      );
      await c.query("commit");
    } finally {
      c.release();
    }
    const sessionId = await s.openSession();
    unwrap(await s.unpay(order.tabId, old));
    const report = unwrap(await getCashSessionReport(env.deps, s.m, sessionId));
    expect(report.removedFromOtherSessions.map((r) => [r.method, money(r.amount)])).toEqual([
      ["CASH", "30.00"],
    ]);
    expect(money(report.expected)).toBe("120.00");
    expect(report.receivedByMethod.every((r) => r.amount.isZero())).toBe(true);
  });

  it("fechar a conta grava o turno aberto; conta de R$ 0,00 fecha sem caixa; reabrir não mexe no turno", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const tabSession = async (tabId: string) =>
      (await db().query("select cash_session_id from table_tabs where id = $1", [tabId])).rows[0]
        .cash_session_id as string | null;

    // Conta de R$ 0,00: o único pedido foi cancelado; fecha sem caixa aberto.
    const cancelled = await s.place("4", [s.juice()]);
    const { cancelOrder } = await import("../../../src/application/ordering/kitchen");
    const v = (await db().query("select version from orders where id = $1", [cancelled.orderId])).rows[0]
      .version;
    unwrap(
      await cancelOrder(env.deps, s.chef, {
        id: cancelled.orderId,
        version: v,
        reason: "CUSTOMER_GAVE_UP",
        note: null,
        ingredientsUsed: false,
      }),
    );
    unwrap(await s.closeTabOf(cancelled.tabId));
    expect(await tabSession(cancelled.tabId)).toBeNull();

    const a = await s.openSession();
    const order = await s.served("12", [s.juice()]);
    unwrap(await s.pay(order.tabId, "PIX", "9.00"));
    unwrap(await s.closeTabOf(order.tabId));
    expect(await tabSession(order.tabId)).toBe(a);

    const tab = unwrap(await getTab(env.deps, s.m, order.tabId));
    unwrap(await reopenTab(env.deps, s.m, { tabId: order.tabId, reason: "Conferir", version: tab.version }));
    expect(await tabSession(order.tabId)).toBe(a);
    unwrap(await s.closeSession(a, "150.00"));
    const b = await s.openSession("150.00");
    unwrap(await s.closeTabOf(order.tabId));
    expect(await tabSession(order.tabId)).toBe(b);
  });
});
