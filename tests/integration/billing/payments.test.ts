import { describe, it, expect } from "vitest";
import { ownerTestDb, testEnv, type TestEnv } from "../harness";
import { code, unwrap } from "../ordering/fixtures";
import { billingScenario } from "./fixtures";
import { getTab } from "../../../src/application/billing/tabs";
import { addPayment, removePayment } from "../../../src/application/billing/payments";
import type { PaymentMethod } from "../../../src/domain/billing/payment";
import { d } from "../../../src/domain/shared/decimal";
import type { RequestContext } from "../../../src/application/context";

/** Spec 011, US2 e FR-003: lançar e tirar pagamentos da conta. */

const db = () => ownerTestDb().$client;
const money = (v: { toFixed(n: number): string } | null) => v?.toFixed(2) ?? null;

/** Mesa 12 com 2 × X-Burger + Suco: total R$ 84,70 (subtotal 77,00 + 10%). */
async function setup(env: TestEnv) {
  const b = await billingScenario(env);
  await b.s.place([b.s.burger(2)]);
  await b.s.place([b.s.juice()]);
  return { ...b, id: await b.tabId() };
}

const pay = (
  env: TestEnv,
  ctx: RequestContext,
  tabId: string,
  method: PaymentMethod,
  amount: string,
  received: string | null = null,
  clientRequestId: string = crypto.randomUUID(),
) =>
  addPayment(env.deps, ctx, {
    tabId,
    method,
    amount: d(amount),
    received: received === null ? null : d(received),
    clientRequestId,
  });

describe("lançar pagamento (spec 011, US2-1 a US2-3)", () => {
  it("cinco formas somam no pago, o falta cai até zero e o histórico guarda cada uma", async () => {
    const env = testEnv();
    const t = await setup(env);
    const v0 = unwrap(await getTab(env.deps, t.cashier, t.id)).version;

    const cash = unwrap(await pay(env, t.cashier, t.id, "CASH", "20.00", "50.00"));
    expect(money(cash.change)).toBe("30.00");
    for (const method of ["PIX", "DEBIT_CARD", "CREDIT_CARD"] as const)
      expect(unwrap(await pay(env, t.cashier, t.id, method, "20.00")).change).toBeNull();
    unwrap(await pay(env, t.m, t.id, "OTHER", "4.70"));

    const tab = unwrap(await getTab(env.deps, t.cashier, t.id));
    expect([money(tab.paid), money(tab.remaining), tab.version]).toEqual(["84.70", "0.00", v0 + 5]);
    expect(
      tab.payments.map((p) => [p.method, money(p.amount), money(p.received), money(p.change), p.byName]),
    ).toEqual([
      ["CASH", "20.00", "50.00", "30.00", "Caixa Carla"],
      ["PIX", "20.00", null, null, "Caixa Carla"],
      ["DEBIT_CARD", "20.00", null, null, "Caixa Carla"],
      ["CREDIT_CARD", "20.00", null, null, "Caixa Carla"],
      ["OTHER", "4.70", null, null, "Gerente"],
    ]);
    const added = tab.events.filter((e) => e.kind === "PAYMENT_ADDED");
    expect(added.map((e) => [e.details?.method, e.details?.amount])).toEqual([
      ["CASH", "20.00"],
      ["PIX", "20.00"],
      ["DEBIT_CARD", "20.00"],
      ["CREDIT_CARD", "20.00"],
      ["OTHER", "4.70"],
    ]);
    const audit = await db().query(
      "select count(*)::int as n from audit_log where entity = 'table_tab' and entity_id = $1 and action = 'UPDATE'",
      [t.id],
    );
    expect(audit.rows[0].n).toBe(5);
  });

  it("dinheiro sem o recebido não tem troco; recebido menor que o valor é recusado", async () => {
    const env = testEnv();
    const t = await setup(env);
    const exact = unwrap(await pay(env, t.cashier, t.id, "CASH", "10.00"));
    expect(money(exact.change)).toBe("0.00");
    expect(code(await pay(env, t.cashier, t.id, "CASH", "10.00", "5.00"))).toBe("RECEIVED_TOO_LOW");
    expect(code(await pay(env, t.cashier, t.id, "PIX", "10.00", "20.00"))).toBe("VALIDATION");
  });

  it("valor acima do que falta é recusado e diz quanto falta; valor inválido também", async () => {
    const env = testEnv();
    const t = await setup(env);
    const over = await pay(env, t.cashier, t.id, "PIX", "84.71");
    expect(over.ok ? null : [over.error.code, over.error.details]).toEqual([
      "PAYMENT_EXCEEDS_REMAINING",
      { remaining: "84.70" },
    ]);
    for (const amount of ["0", "-1.00", "10.001"])
      expect(code(await pay(env, t.cashier, t.id, "PIX", amount))).toBe("INVALID_AMOUNT");
    expect(unwrap(await getTab(env.deps, t.cashier, t.id)).payments).toEqual([]);
  });

  it("dois caixas pagando ao mesmo tempo nunca passam do total", async () => {
    const env = testEnv();
    const t = await setup(env);
    const both = await Promise.all([
      pay(env, t.cashier, t.id, "PIX", "50.00"),
      pay(env, t.m, t.id, "DEBIT_CARD", "50.00"),
    ]);
    expect(both.map(code).sort()).toEqual(["OK", "PAYMENT_EXCEEDS_REMAINING"]);
    const tab = unwrap(await getTab(env.deps, t.cashier, t.id));
    expect([money(tab.paid), money(tab.remaining)]).toEqual(["50.00", "34.70"]);
  });

  it("toque duplo (mesmo pedido de pagamento) devolve o mesmo pagamento, uma vez só", async () => {
    const env = testEnv();
    const t = await setup(env);
    const requestId = crypto.randomUUID();
    const [a, b] = await Promise.all([
      pay(env, t.cashier, t.id, "CASH", "20.00", "50.00", requestId),
      pay(env, t.cashier, t.id, "CASH", "20.00", "50.00", requestId),
    ]);
    const again = await pay(env, t.cashier, t.id, "CASH", "20.00", "50.00", requestId);
    const ids = [a, b, again].map((r) => unwrap(r).paymentId);
    expect(new Set(ids).size).toBe(1);
    expect(money(unwrap(again).change)).toBe("30.00");
    expect(unwrap(await getTab(env.deps, t.cashier, t.id)).payments).toHaveLength(1);
  });
});

describe("tirar pagamento lançado errado (spec 011, US2-4)", () => {
  it("grava quem tirou e quando, o falta volta e o pagamento continua na lista como tirado", async () => {
    const env = testEnv();
    const t = await setup(env);
    const { paymentId } = unwrap(await pay(env, t.cashier, t.id, "PIX", "84.70"));
    env.clock.advance(60_000);
    unwrap(await removePayment(env.deps, t.cashier, { tabId: t.id, paymentId }));

    const tab = unwrap(await getTab(env.deps, t.cashier, t.id));
    expect([money(tab.paid), money(tab.remaining)]).toEqual(["0.00", "84.70"]);
    expect(tab.payments.map((p) => [p.removedAt, p.removedByName])).toEqual([[env.clock.now(), "Caixa Carla"]]);
    const removed = tab.events.filter((e) => e.kind === "PAYMENT_REMOVED");
    expect(removed.map((e) => [e.details?.paymentId, e.details?.amount, e.userName])).toEqual([
      [paymentId, "84.70", "Caixa Carla"],
    ]);
    expect(code(await removePayment(env.deps, t.cashier, { tabId: t.id, paymentId }))).toBe("ALREADY_REMOVED");
    const rows = await db().query("select count(*)::int as n from tab_payments where id = $1", [paymentId]);
    expect(rows.rows[0].n).toBe(1);
  });

  it("pagamento de outra conta não é achado", async () => {
    const env = testEnv();
    const t = await setup(env);
    const { paymentId } = unwrap(await pay(env, t.cashier, t.id, "PIX", "10.00"));
    const other = await t.placeAt("13", [t.s.juice()]);
    expect(code(await removePayment(env.deps, t.cashier, { tabId: other.tabId, paymentId }))).toBe("NOT_FOUND");
  });
});

describe("conta fechada e permissões (spec 011, US2)", () => {
  it("conta fechada não recebe nem perde pagamento", async () => {
    const env = testEnv();
    const t = await setup(env);
    const { paymentId } = unwrap(await pay(env, t.cashier, t.id, "PIX", "10.00"));
    await db().query(
      `update table_tabs set status = 'CLOSED', closed_at = $2, closed_by = $3, closed_day = '2026-01-01',
              subtotal = 77, service_charge = 7.70, total = 84.70, version = version + 1
        where id = $1`,
      [t.id, env.clock.now(), t.cashier.userId],
    );
    expect(code(await pay(env, t.cashier, t.id, "PIX", "10.00"))).toBe("TAB_CLOSED");
    expect(code(await removePayment(env.deps, t.cashier, { tabId: t.id, paymentId }))).toBe("TAB_CLOSED");
  });

  it("garçom e estoquista não lançam pagamento; a tentativa fica na auditoria", async () => {
    const env = testEnv();
    const t = await setup(env);
    expect(code(await pay(env, t.waiter, t.id, "PIX", "10.00"))).toBe("FORBIDDEN");
    expect(code(await pay(env, t.stockkeeper, t.id, "PIX", "10.00"))).toBe("FORBIDDEN");
    const denied = await db().query(
      "select count(*)::int as n from audit_log where action = 'DENIED' and entity = 'table_tab' and entity_id = $1",
      [t.id],
    );
    expect(denied.rows[0].n).toBe(2);
  });

  it("conta que não existe ou id malformado: NOT_FOUND", async () => {
    const env = testEnv();
    const t = await setup(env);
    expect(code(await pay(env, t.cashier, crypto.randomUUID(), "PIX", "10.00"))).toBe("NOT_FOUND");
    expect(code(await pay(env, t.cashier, "nao-e-um-id", "PIX", "10.00"))).toBe("NOT_FOUND");
  });
});
