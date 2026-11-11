import { describe, it, expect } from "vitest";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";
import { orderingScenario, scan, tableWithQr, unwrap } from "../ordering/fixtures";
import { submitOrder } from "../../../src/application/ordering/submit-order";

/** Spec 011, US1 e FR-001: a conta abre sozinha no primeiro pedido e recebe todos os pedidos da mesa. */

const db = () => ownerTestDb().$client;
const tabsOf = async (tableId: string) =>
  (
    await db().query(
      "select id, status, service_rate, version, opened_at from table_tabs where table_id = $1 order by created_at",
      [tableId],
    )
  ).rows;
const tabOfOrder = async (orderId: string) =>
  (await db().query("select tab_id from orders where id = $1", [orderId])).rows[0].tab_id as string | null;

describe("conta da mesa abre com o pedido (spec 011, US1)", () => {
  it("primeiro pedido abre a conta com a taxa do restaurante; o histórico diz que o cliente abriu", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    expect(await tabsOf(s.table.tableId)).toEqual([]);

    const first = await s.place([s.burger(2)]);
    const tabs = await tabsOf(s.table.tableId);
    expect(tabs).toEqual([
      { id: expect.any(String), status: "OPEN", service_rate: "10.00", version: 1, opened_at: env.clock.now() },
    ]);
    expect(await tabOfOrder(first.orderId)).toBe(tabs[0].id);
    const events = await db().query("select kind, user_id from tab_events where tab_id = $1", [tabs[0].id]);
    expect(events.rows).toEqual([{ kind: "OPENED", user_id: null }]);
  });

  it("os pedidos seguintes da mesa, de qualquer celular, entram na mesma conta e mudam a versão", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const first = await s.place([s.burger(2)]);
    const otherPhone = await scan(env, s.table.token);
    const second = unwrap(
      await submitOrder(env.deps, otherPhone, { clientRequestId: crypto.randomUUID(), lines: [s.juice()] }),
    );
    const tabs = await tabsOf(s.table.tableId);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].version).toBe(2);
    expect(await tabOfOrder(first.orderId)).toBe(tabs[0].id);
    expect(await tabOfOrder(second.orderId)).toBe(tabs[0].id);
  });

  it("dois envios ao mesmo tempo numa mesa sem conta abrem uma conta só", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const phones = [s.cookie, await scan(env, s.table.token), await scan(env, s.table.token)];
    const sent = await Promise.all(
      phones.map((cookie) =>
        submitOrder(env.deps, cookie, { clientRequestId: crypto.randomUUID(), lines: [s.juice()] }),
      ),
    );
    expect(sent.every((r) => r.ok)).toBe(true);
    const tabs = await tabsOf(s.table.tableId);
    expect(tabs).toHaveLength(1);
    const orders = await db().query("select distinct tab_id from orders where table_id = $1", [s.table.tableId]);
    expect(orders.rows).toEqual([{ tab_id: tabs[0].id }]);
  });

  it("toque duplo no envio não abre conta nem soma versão de novo", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const input = { clientRequestId: crypto.randomUUID(), lines: [s.juice()] };
    unwrap(await submitOrder(env.deps, s.cookie, input));
    unwrap(await submitOrder(env.deps, s.cookie, input));
    expect((await tabsOf(s.table.tableId)).map((t) => t.version)).toEqual([1]);
  });

  it("mudar a taxa do restaurante não muda a conta aberta; vale para a próxima conta", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    await s.place([s.juice()]);
    await db().query("update restaurants set service_charge_rate = 12.5 where id = $1", [m.restaurantId]);
    await s.place([s.juice()]);
    expect((await tabsOf(s.table.tableId)).map((t) => t.service_rate)).toEqual(["10.00"]);

    const other = await tableWithQr(env, m, "13");
    const phone = await scan(env, other.token);
    unwrap(await submitOrder(env.deps, phone, { clientRequestId: crypto.randomUUID(), lines: [s.juice()] }));
    expect((await tabsOf(other.tableId)).map((t) => t.service_rate)).toEqual(["12.50"]);

    await db().query("update restaurants set service_charge_rate = null where id = $1", [m.restaurantId]);
    const third = await tableWithQr(env, m, "14");
    const phone3 = await scan(env, third.token);
    unwrap(await submitOrder(env.deps, phone3, { clientRequestId: crypto.randomUUID(), lines: [s.juice()] }));
    expect((await tabsOf(third.tableId)).map((t) => t.service_rate)).toEqual([null]);
  });

  it("cada mesa tem a sua conta", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    await s.place([s.juice()]);
    const other = await tableWithQr(env, m, "13");
    const phone = await scan(env, other.token);
    unwrap(await submitOrder(env.deps, phone, { clientRequestId: crypto.randomUUID(), lines: [s.juice()] }));
    expect(await tabsOf(s.table.tableId)).toHaveLength(1);
    expect(await tabsOf(other.tableId)).toHaveLength(1);
    const missing = await db().query("select count(*)::int as n from orders where tab_id is null");
    expect(missing.rows[0].n).toBe(0);
  });
});
