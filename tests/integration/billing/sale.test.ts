import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv, type TestEnv } from "../harness";
import { code, orderingScenario, unwrap } from "../ordering/fixtures";
import { advanceOrderStatus } from "../../../src/application/ordering/kitchen";
import {
  listMovements,
  registerPurchase,
  reverseMovement,
} from "../../../src/application/inventory/movements";
import { updateRecipe } from "../../../src/application/inventory/recipes";
import { recordOrderSale, reverseOrderSale } from "../../../src/application/inventory/sales";
import { stockReport } from "../../../src/application/inventory/stock-report";
import { reasonByCode } from "../../../src/domain/inventory/movement-reasons";
import type { Deps } from "../../../src/application/ports";
import { d } from "../../../src/domain/shared/decimal";
import { itemLine } from "../../builders/recipe-data";

/** Spec 011, US4 e FR-006/FR-007: "Começar preparo" baixa o consumo do pedido no livro. */

const db = () => ownerTestDb().$client;

async function sales(orderId: string) {
  const r = await db().query(
    `select item_id, quantity::text, unit_cost::text, total_cost::text, created_by, occurred_at, reason_id
       from stock_movements where order_id = $1 and type = 'SALE_RECIPE' order by item_id`,
    [orderId],
  );
  return r.rows;
}

async function balance(itemId: string) {
  const r = await db().query(
    `select (select quantity::text from stock_balances where item_id = $1) as projected,
            (select coalesce(sum(quantity), 0)::text from stock_movements where item_id = $1) as ledger`,
    [itemId],
  );
  return r.rows[0] as { projected: string | null; ledger: string };
}

/** Mesa 12 com 1 kg de queijo comprado a R$ 50,00 e o pedido 2 × X-Burger + 2 Fatia de queijo sem cebola. */
async function setup(env: TestEnv) {
  const m = await newRestaurant(env);
  const s = await orderingScenario(env, m);
  unwrap(
    await registerPurchase(env.deps, m, {
      itemId: s.queijo,
      quantity: d("1"),
      unit: "kg",
      totalPaid: d("50.00"),
      occurredAt: env.clock.now(),
      notes: null,
      idempotencyKey: null,
    }),
  );
  const chef = await addMember(env, m, ["CHEF"], "Chef Ana");
  const order = await s.place([s.burger(2)]);
  return { m, s, chef, orderId: order.orderId, number: order.number };
}

describe("baixa do estoque ao começar o preparo (spec 011, US4)", () => {
  it("2 × X-Burger com + 2 Fatia de queijo e sem cebola: queijo −0,14 kg, pão −2, carne −0,3 kg, cebola nada", async () => {
    const env = testEnv();
    const { s, chef, orderId } = await setup(env);
    expect(await sales(orderId)).toEqual([]);

    env.clock.advance(60_000);
    unwrap(await advanceOrderStatus(env.deps, chef, { id: orderId, to: "PREPARING", version: 1 }));

    const at = env.clock.now();
    const expected = [
      { item: s.pao, quantity: "-2.0000", unitCost: "1.0000", total: "-2.00" },
      { item: s.carne, quantity: "-0.3000", unitCost: "40.0000", total: "-12.00" },
      { item: s.queijo, quantity: "-0.1400", unitCost: "50.0000", total: "-7.00" },
    ].sort((a, b) => a.item.localeCompare(b.item));
    expect(await sales(orderId)).toEqual(
      expected.map((e) => ({
        item_id: e.item,
        quantity: e.quantity,
        unit_cost: e.unitCost,
        total_cost: e.total,
        created_by: chef.userId,
        occurred_at: at,
        reason_id: null,
      })),
    );
    expect(await balance(s.queijo)).toEqual({ projected: "0.8600", ledger: "0.8600" });
    const audit = await db().query(
      "select count(*)::int as n from audit_log where entity = 'stock_movement' and user_id = $1",
      [chef.userId],
    );
    expect(audit.rows[0].n).toBe(3);
  });

  it("não bloqueia por saldo: carne sem estoque fica negativa e o saldo é a soma do livro", async () => {
    const env = testEnv();
    const { s, chef, orderId } = await setup(env);
    unwrap(await advanceOrderStatus(env.deps, chef, { id: orderId, to: "PREPARING", version: 1 }));
    expect(await balance(s.carne)).toEqual({ projected: "-0.3000", ledger: "-0.3000" });
  });

  it("item sem custo ainda baixa, com custo zero", async () => {
    const env = testEnv();
    const { s, chef, orderId } = await setup(env);
    await db().query("update items set average_cost = null where id = $1", [s.pao]);
    unwrap(await advanceOrderStatus(env.deps, chef, { id: orderId, to: "PREPARING", version: 1 }));
    const pao = (await sales(orderId)).find((r) => r.item_id === s.pao);
    expect([pao?.quantity, pao?.unit_cost, pao?.total_cost]).toEqual(["-2.0000", "0.0000", "0.00"]);
  });

  it("mudar a ficha depois do envio não muda a baixa: vale a versão gravada no pedido", async () => {
    const env = testEnv();
    const { m, s, chef, orderId } = await setup(env);
    unwrap(
      await updateRecipe(env.deps, m, s.burgerId, 3, {
        name: "X-Burger",
        kind: "DISH",
        yieldQuantity: null,
        yieldUnit: null,
        lines: [itemLine(s.pao, "1", "un"), itemLine(s.carne, "200", "g")],
      }),
    );
    unwrap(await advanceOrderStatus(env.deps, chef, { id: orderId, to: "PREPARING", version: 1 }));
    const carne = (await sales(orderId)).find((r) => r.item_id === s.carne);
    expect(carne?.quantity).toBe("-0.3000");
  });

  it("tocar duas vezes ou em duas telas baixa uma vez só", async () => {
    const env = testEnv();
    const { chef, orderId } = await setup(env);
    const both = await Promise.all([
      advanceOrderStatus(env.deps, chef, { id: orderId, to: "PREPARING", version: 1 }),
      advanceOrderStatus(env.deps, chef, { id: orderId, to: "PREPARING", version: 1 }),
    ]);
    expect(both.map(code).sort()).toEqual(["OK", "STALE_RECORD"]);
    expect(await sales(orderId)).toHaveLength(3);
    expect(code(await advanceOrderStatus(env.deps, chef, { id: orderId, to: "PREPARING", version: 2 }))).toBe(
      "INVALID_ORDER_TRANSITION",
    );
    expect(await sales(orderId)).toHaveLength(3);
  });

  it("Pronto e Entregue não baixam de novo", async () => {
    const env = testEnv();
    const { m, chef, orderId } = await setup(env);
    const waiter = await addMember(env, m, ["WAITER"], "Garçom Beto");
    unwrap(await advanceOrderStatus(env.deps, chef, { id: orderId, to: "PREPARING", version: 1 }));
    unwrap(await advanceOrderStatus(env.deps, chef, { id: orderId, to: "READY", version: 2 }));
    const { markDelivered } = await import("../../../src/application/ordering/kitchen");
    unwrap(await markDelivered(env.deps, waiter, { id: orderId, version: 3 }));
    expect(await sales(orderId)).toHaveLength(3);
  });

  it("falha no meio da baixa desfaz a mudança de situação", async () => {
    const env = testEnv();
    const { chef, orderId } = await setup(env);
    let inserts = 0;
    const failing: Deps = {
      ...env.deps,
      tenant: (restaurantId, fn) =>
        env.deps.tenant(restaurantId, (repos) =>
          fn({
            ...repos,
            movements: {
              ...repos.movements,
              insert: async (mv) => {
                if (++inserts === 2) throw new Error("falha no meio da baixa");
                return repos.movements.insert(mv);
              },
            },
          }),
        ),
    };
    await expect(
      advanceOrderStatus(failing, chef, { id: orderId, to: "PREPARING", version: 1 }),
    ).rejects.toThrow(/falha no meio/);
    const o = await db().query("select status, version from orders where id = $1", [orderId]);
    expect(o.rows[0]).toEqual({ status: "RECEIVED", version: 1 });
    expect(await sales(orderId)).toEqual([]);
  });

  it("lançamentos mostram a venda com o pedido e a mesa; venda não se estorna à mão", async () => {
    const env = testEnv();
    const { m, s, chef, orderId, number } = await setup(env);
    unwrap(await advanceOrderStatus(env.deps, chef, { id: orderId, to: "PREPARING", version: 1 }));
    const rows = unwrap(await listMovements(env.deps, m, { itemId: s.queijo }));
    const sale = rows.find((r) => r.type === "SALE_RECIPE")!;
    expect(sale.order).toEqual({ id: orderId, number, tableName: "12" });
    expect(sale.recordedByName).toBe("Chef Ana");
    const reason = reasonByCode("REVERSAL", "WRONG_ENTRY")!;
    expect(
      code(
        await reverseMovement(env.deps, m, sale.id, {
          reasonId: reason.id,
          notes: null,
          idempotencyKey: null,
        }),
      ),
    ).toBe("REVERSE_VIA_ORDER");
  });
});

describe("baixa e estorno da venda: casos que faltavam (spec 018, US2)", () => {
  it("linha que arredonda para zero na precisão do livro não sai", async () => {
    const env = testEnv();
    const { m, s, chef } = await setup(env);
    unwrap(
      await updateRecipe(env.deps, m, s.burgerId, 3, {
        name: "X-Burger",
        kind: "DISH",
        yieldQuantity: null,
        yieldUnit: null,
        lines: [itemLine(s.pao, "1", "un"), itemLine(s.carne, "150", "g"), itemLine(s.bacon, "0.04", "g")],
      }),
    );
    const order = await s.place([
      { recipeId: s.burgerId, quantity: 1, unitPrice: "28.00", addons: [], removals: [] },
    ]);
    unwrap(await advanceOrderStatus(env.deps, chef, { id: order.orderId, to: "PREPARING", version: 1 }));
    expect((await sales(order.orderId)).map((r) => r.item_id).sort()).toEqual([s.pao, s.carne].sort());
  });

  it("pedido que não existe não baixa nada; estornar duas vezes estorna uma vez só", async () => {
    const env = testEnv();
    const { m, chef, orderId } = await setup(env);
    unwrap(await advanceOrderStatus(env.deps, chef, { id: orderId, to: "PREPARING", version: 1 }));
    const inTx = <T>(fn: (repos: Parameters<Parameters<Deps["tenant"]>[1]>[0]) => Promise<T>) =>
      env.deps.tenant(m.restaurantId, async (repos) => ({ ok: true as const, value: await fn(repos) }));
    const missing = unwrap(await inTx((repos) => recordOrderSale(env.deps, m, repos, crypto.randomUUID())));
    expect(code(missing)).toBe("NOT_FOUND");
    const first = unwrap(await inTx((repos) => reverseOrderSale(env.deps, m, repos, orderId, false)));
    const again = unwrap(await inTx((repos) => reverseOrderSale(env.deps, m, repos, orderId, false)));
    expect([first.length, again]).toEqual([3, []]);
  });

  it("o relatório do estoque mostra a venda como 'Venda'; garçom não vê o relatório", async () => {
    const env = testEnv();
    const { m, chef, orderId } = await setup(env);
    unwrap(await advanceOrderStatus(env.deps, chef, { id: orderId, to: "PREPARING", version: 1 }));
    const report = unwrap(await stockReport(env.deps, m, "30"));
    expect(report.byReason.map((r) => r.label)).toContain("Venda");
    const waiter = await addMember(env, m, ["WAITER"]);
    expect(code(await stockReport(env.deps, waiter, "30"))).toBe("FORBIDDEN");
  });
});
