import { describe, it, expect } from "vitest";
import { ownerTestDb, testEnv, type TestEnv } from "../harness";
import { code, unwrap } from "../ordering/fixtures";
import { billingScenario } from "./fixtures";
import { cancelOrder } from "../../../src/application/ordering/kitchen";
import { getTab } from "../../../src/application/billing/tabs";
import { registerPurchase } from "../../../src/application/inventory/movements";
import { reasonByCode } from "../../../src/domain/inventory/movement-reasons";
import { d } from "../../../src/domain/shared/decimal";

/** Spec 011, US5 e FR-008: cancelar pedido depois do preparo estorna a venda e, se usados, lança a perda. */

const db = () => ownerTestDb().$client;

/** Todas as linhas do pedido no livro, por item e ordem de gravação. */
async function ledger(orderId: string) {
  const r = await db().query(
    `select type, item_id, quantity::text, unit_cost::text, total_cost::text, reason_id, reverses_id, created_by
       from stock_movements where order_id = $1 order by item_id, created_at, type`,
    [orderId],
  );
  return r.rows;
}

async function balance(itemId: string) {
  const r = await db().query("select quantity::text from stock_balances where item_id = $1", [itemId]);
  return (r.rows[0]?.quantity as string | undefined) ?? null;
}

/** Mesa 12 com 1 kg de queijo a R$ 50,00 e 2 × X-Burger (+ queijo, sem cebola) em preparo. */
async function setup(env: TestEnv) {
  const b = await billingScenario(env);
  unwrap(
    await registerPurchase(env.deps, b.m, {
      itemId: b.s.queijo,
      quantity: d("1"),
      unit: "kg",
      totalPaid: d("50.00"),
      occurredAt: env.clock.now(),
      notes: null,
      idempotencyKey: null,
    }),
  );
  const order = await b.s.place([b.s.burger(2)]);
  const before = {
    queijo: await balance(b.s.queijo),
    carne: await balance(b.s.carne),
    pao: await balance(b.s.pao),
  };
  await b.advance(order.orderId, "PREPARING");
  const sales = await ledger(order.orderId);
  return { ...b, orderId: order.orderId, before, sales };
}

const cancel = (
  env: TestEnv,
  t: Awaited<ReturnType<typeof setup>>,
  version: number,
  ingredientsUsed?: boolean,
) =>
  cancelOrder(env.deps, t.chef, {
    id: t.orderId,
    reason: "CUSTOMER_GAVE_UP",
    note: null,
    version,
    ...(ingredientsUsed === undefined ? {} : { ingredientsUsed }),
  });

describe("cancelar pedido e o estoque (spec 011, US5)", () => {
  it("pedido só recebido: cancelar não mexe no estoque e não pergunta nada", async () => {
    const env = testEnv();
    const b = await billingScenario(env);
    const order = await b.s.place([b.s.burger(2)]);
    unwrap(
      await cancelOrder(env.deps, b.chef, {
        id: order.orderId,
        reason: "CUSTOMER_GAVE_UP",
        note: null,
        version: 1,
      }),
    );
    expect(await ledger(order.orderId)).toEqual([]);
  });

  it("em preparo ou pronto sem dizer se os ingredientes foram usados: recusa e nada muda", async () => {
    const env = testEnv();
    const t = await setup(env);
    const r = await cancel(env, t, 2);
    expect(r.ok ? null : [r.error.code, r.error.field]).toEqual([
      "INGREDIENTS_USED_REQUIRED",
      "ingredientsUsed",
    ]);
    const o = await db().query("select status from orders where id = $1", [t.orderId]);
    expect(o.rows[0].status).toBe("PREPARING");
    expect(await ledger(t.orderId)).toEqual(t.sales);
  });

  it("'Sim, já foram usados': estorna cada venda e lança a mesma saída como perda 'Pedido cancelado'", async () => {
    const env = testEnv();
    const t = await setup(env);
    const afterSale = {
      queijo: await balance(t.s.queijo),
      carne: await balance(t.s.carne),
      pao: await balance(t.s.pao),
    };
    env.clock.advance(60_000);
    unwrap(await cancel(env, t, 2, true));

    const rows = await ledger(t.orderId);
    const reversal = reasonByCode("REVERSAL", "ORDER_CANCELLED")!.id;
    const loss = reasonByCode("LOSS", "ORDER_CANCELLED")!.id;
    for (const sale of t.sales) {
      const mine = rows.filter((r) => r.item_id === sale.item_id);
      const back = sale.quantity.replace("-", "");
      expect(mine.map((r) => [r.type, r.quantity, r.unit_cost, r.reason_id, r.created_by])).toEqual([
        ["SALE_RECIPE", sale.quantity, sale.unit_cost, null, t.chef.userId],
        ["LOSS", sale.quantity, sale.unit_cost, loss, t.chef.userId],
        ["REVERSAL", back, sale.unit_cost, reversal, t.chef.userId],
      ]);
      expect(mine.find((r) => r.type === "REVERSAL")!.reverses_id).toBe(
        (
          await db().query(
            "select id from stock_movements where order_id = $1 and item_id = $2 and type = 'SALE_RECIPE'",
            [t.orderId, sale.item_id],
          )
        ).rows[0].id,
      );
    }
    expect({
      queijo: await balance(t.s.queijo),
      carne: await balance(t.s.carne),
      pao: await balance(t.s.pao),
    }).toEqual(afterSale);
  });

  it("'Não': só estorna e o saldo volta ao de antes do preparo", async () => {
    const env = testEnv();
    const t = await setup(env);
    unwrap(await cancel(env, t, 2, false));
    const rows = await ledger(t.orderId);
    expect(rows.filter((r) => r.type === "LOSS")).toEqual([]);
    expect(rows.filter((r) => r.type === "REVERSAL")).toHaveLength(t.sales.length);
    expect({
      queijo: await balance(t.s.queijo),
      carne: await balance(t.s.carne),
      pao: await balance(t.s.pao),
    }).toEqual({
      queijo: t.before.queijo,
      carne: "0.0000",
      pao: "0.0000",
    });
  });

  it("pedido pronto também pergunta; a perda não é barrada por saldo negativo", async () => {
    const env = testEnv();
    const t = await setup(env);
    await t.advance(t.orderId, "READY");
    expect(code(await cancel(env, t, 3))).toBe("INGREDIENTS_USED_REQUIRED");
    unwrap(await cancel(env, t, 3, true));
    expect(await balance(t.s.carne)).toBe("-0.3000");
  });

  it("nada do livro é editado ou apagado; cancelar de novo é recusado e não estorna duas vezes", async () => {
    const env = testEnv();
    const t = await setup(env);
    const both = await Promise.all([cancel(env, t, 2, true), cancel(env, t, 2, false)]);
    expect(both.map(code).sort()).toEqual(["OK", "STALE_RECORD"]);
    const rows = await ledger(t.orderId);
    expect(rows.filter((r) => r.type === "SALE_RECIPE")).toEqual(t.sales);
    expect(rows.filter((r) => r.type === "REVERSAL")).toHaveLength(t.sales.length);
    expect(code(await cancel(env, t, 3, true))).toBe("INVALID_ORDER_TRANSITION");
  });

  it("a conta da mesa muda de versão e o pedido cancelado sai do total", async () => {
    const env = testEnv();
    const t = await setup(env);
    const tabId = await t.tabId();
    const before = unwrap(await getTab(env.deps, t.cashier, tabId));
    unwrap(await cancel(env, t, 2, false));
    const after = unwrap(await getTab(env.deps, t.cashier, tabId));
    expect(after.version).toBe(before.version + 1);
    expect([before.total.toFixed(2), after.total.toFixed(2)]).toEqual(["74.80", "0.00"]);
  });
});
