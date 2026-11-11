import { describe, it, expect } from "vitest";
import { ownerTestDb, testEnv, type TestEnv } from "../harness";
import { code, unwrap } from "../ordering/fixtures";
import { billingScenario } from "./fixtures";
import { getTab, setServiceWaived } from "../../../src/application/billing/tabs";
import { getServiceChargeSettings, setServiceChargeRate } from "../../../src/application/billing/settings";
import { d } from "../../../src/domain/shared/decimal";

/** Spec 011, US1-8 e FR-004: tirar e pôr de volta a taxa de uma conta; a porcentagem do restaurante. */

const db = () => ownerTestDb().$client;
const money = (v: { toFixed(n: number): string }) => v.toFixed(2);

/** Mesa 12 com 2 × X-Burger + Suco: subtotal R$ 77,00, taxa 10% = R$ 7,70, total R$ 84,70. */
async function setup(env: TestEnv) {
  const b = await billingScenario(env);
  await b.s.place([b.s.burger(2)]);
  await b.s.place([b.s.juice()]);
  const tabId = await b.tabId();
  const version = unwrap(await getTab(env.deps, b.cashier, tabId)).version;
  return { ...b, id: tabId, version };
}

/** Pagamento gravado direto (os casos de uso de pagamento são da US2). */
async function paid(env: TestEnv, restaurantId: string, tabId: string, by: string, amount: string) {
  await db().query(
    `insert into tab_payments (id, restaurant_id, created_at, created_by, tab_id, method, amount, client_request_id)
     values ($1, $2, $3, $4, $5, 'PIX', $6, $7)`,
    [crypto.randomUUID(), restaurantId, env.clock.now(), by, tabId, amount, crypto.randomUUID()],
  );
  await db().query("update table_tabs set version = version + 1 where id = $1", [tabId]);
}

describe("tirar a taxa de serviço de uma conta (spec 011, US1-8)", () => {
  it("tirar zera a taxa só nessa conta e o histórico diz quem e quando; pôr de volta desfaz", async () => {
    const env = testEnv();
    const t = await setup(env);
    env.clock.advance(60_000);
    unwrap(await setServiceWaived(env.deps, t.cashier, { tabId: t.id, waived: true, version: t.version }));

    const off = unwrap(await getTab(env.deps, t.cashier, t.id));
    expect([off.serviceWaived, money(off.serviceCharge), money(off.total), off.version]).toEqual([
      true,
      "0.00",
      "77.00",
      t.version + 1,
    ]);
    const waivedAt = env.clock.now();

    env.clock.advance(60_000);
    unwrap(await setServiceWaived(env.deps, t.cashier, { tabId: t.id, waived: false, version: off.version }));
    const on = unwrap(await getTab(env.deps, t.cashier, t.id));
    expect([on.serviceWaived, money(on.serviceCharge), money(on.total)]).toEqual([false, "7.70", "84.70"]);
    expect(on.events.map((e) => [e.kind, e.userName, e.at])).toEqual([
      ["OPENED", null, expect.any(Date)],
      ["SERVICE_WAIVED", "Caixa Carla", waivedAt],
      ["SERVICE_RESTORED", "Caixa Carla", env.clock.now()],
    ]);
    const audit = await db().query(
      "select action, changes from audit_log where entity = 'table_tab' and entity_id = $1 order by occurred_at",
      [t.id],
    );
    expect(audit.rows).toEqual([
      { action: "UPDATE", changes: { serviceWaived: [false, true] } },
      { action: "UPDATE", changes: { serviceWaived: [true, false] } },
    ]);
  });

  it("versão antiga é recusada (outra tela mudou a conta)", async () => {
    const env = testEnv();
    const t = await setup(env);
    await t.s.place([t.s.juice()]);
    expect(code(await setServiceWaived(env.deps, t.cashier, { tabId: t.id, waived: true, version: t.version }))).toBe(
      "STALE_RECORD",
    );
  });

  it("conta sem taxa não tem o que tirar", async () => {
    const env = testEnv();
    const b = await billingScenario(env);
    await db().query("update restaurants set service_charge_rate = null where id = $1", [b.m.restaurantId]);
    await b.s.place([b.s.juice()]);
    const id = await b.tabId();
    expect(code(await setServiceWaived(env.deps, b.cashier, { tabId: id, waived: true, version: 1 }))).toBe(
      "NO_SERVICE_CHARGE",
    );
  });

  it("tirar é recusado se o que já foi pago passaria do novo total", async () => {
    const env = testEnv();
    const t = await setup(env);
    await paid(env, t.m.restaurantId, t.id, t.cashier.userId, "80.00");
    const r = await setServiceWaived(env.deps, t.cashier, { tabId: t.id, waived: true, version: t.version + 1 });
    expect(code(r)).toBe("PAYMENT_EXCEEDS_REMAINING");
    const tab = unwrap(await getTab(env.deps, t.cashier, t.id));
    expect([tab.serviceWaived, money(tab.total)]).toEqual([false, "84.70"]);
  });

  it("conta fechada não muda", async () => {
    const env = testEnv();
    const t = await setup(env);
    await db().query(
      `update table_tabs set status = 'CLOSED', closed_at = $2, closed_by = $3, closed_day = '2026-01-01',
              subtotal = 77, service_charge = 7.70, total = 84.70, version = version + 1
        where id = $1`,
      [t.id, env.clock.now(), t.cashier.userId],
    );
    expect(code(await setServiceWaived(env.deps, t.cashier, { tabId: t.id, waived: true, version: t.version + 1 }))).toBe(
      "TAB_CLOSED",
    );
  });

  it("só gerente e caixa tiram a taxa; garçom é recusado e fica na auditoria", async () => {
    const env = testEnv();
    const t = await setup(env);
    expect(code(await setServiceWaived(env.deps, t.waiter, { tabId: t.id, waived: true, version: t.version }))).toBe(
      "FORBIDDEN",
    );
    const denied = await db().query(
      "select count(*)::int as n from audit_log where action = 'DENIED' and user_id = $1 and entity = 'table_tab'",
      [t.waiter.userId],
    );
    expect(denied.rows[0].n).toBe(1);
    unwrap(await setServiceWaived(env.deps, t.m, { tabId: t.id, waived: true, version: t.version }));
  });
});

describe("taxa de serviço do restaurante (spec 011, FR-004)", () => {
  it("começa em 10%; o gerente muda para 12,5% ou desliga, com auditoria", async () => {
    const env = testEnv();
    const b = await billingScenario(env);
    const s = unwrap(await getServiceChargeSettings(env.deps, b.cashier));
    expect(s.rate?.toString()).toBe("10");

    unwrap(await setServiceChargeRate(env.deps, b.m, { rate: d("12.5"), version: s.version }));
    const after = unwrap(await getServiceChargeSettings(env.deps, b.m));
    expect([after.rate?.toFixed(2), after.version]).toEqual(["12.50", s.version + 1]);

    env.clock.advance(60_000);
    unwrap(await setServiceChargeRate(env.deps, b.m, { rate: null, version: after.version }));
    expect(unwrap(await getServiceChargeSettings(env.deps, b.m)).rate).toBeNull();

    const audit = await db().query(
      "select changes from audit_log where entity = 'restaurant' and changes ? 'serviceChargeRate' and entity_id = $1 order by occurred_at",
      [b.m.restaurantId],
    );
    expect(audit.rows.map((r) => r.changes)).toEqual([
      { serviceChargeRate: ["10.00", "12.50"] },
      { serviceChargeRate: ["12.50", null] },
    ]);
  });

  it("fora de 0 a 20% ou com mais de 2 casas é recusado; versão antiga também", async () => {
    const env = testEnv();
    const b = await billingScenario(env);
    const { version } = unwrap(await getServiceChargeSettings(env.deps, b.m));
    expect(code(await setServiceChargeRate(env.deps, b.m, { rate: d("20.01"), version }))).toBe("INVALID_RATE");
    expect(code(await setServiceChargeRate(env.deps, b.m, { rate: d("10.555"), version }))).toBe("INVALID_RATE");
    expect(code(await setServiceChargeRate(env.deps, b.m, { rate: d("-1"), version }))).toBe("INVALID_RATE");
    unwrap(await setServiceChargeRate(env.deps, b.m, { rate: d("0"), version }));
    expect(code(await setServiceChargeRate(env.deps, b.m, { rate: d("15"), version }))).toBe("STALE_RECORD");
  });

  it("só o gerente muda a porcentagem; o caixa é recusado", async () => {
    const env = testEnv();
    const b = await billingScenario(env);
    const { version } = unwrap(await getServiceChargeSettings(env.deps, b.cashier));
    expect(code(await setServiceChargeRate(env.deps, b.cashier, { rate: d("12"), version }))).toBe("FORBIDDEN");
    expect(code(await getServiceChargeSettings(env.deps, b.stockkeeper))).toBe("FORBIDDEN");
  });
});
