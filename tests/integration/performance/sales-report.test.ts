import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ownerTestDb, testEnv, type TestEnv } from "../harness";
import { unwrap } from "../ordering/fixtures";
import { cashScenario } from "../cash/fixtures";
import { countingEnv } from "./counting";
import { salesReport } from "../../../src/application/cash/sales";

const DAY = "2026-10-31";
const db = () => ownerTestDb().$client;

/** Copia o pedido dado `n` vezes no mesmo dia, com as linhas e os adicionais (SQL direto: rápido). */
async function copies(orderId: string, n: number, from: number) {
  await db().query(
    `with src as (select * from orders where id = $1),
          made as (
            insert into orders (id, restaurant_id, created_at, created_by, table_id, menu_access_id,
                                client_request_id, business_day, number, status, cancel_reason, cancel_note,
                                total, submitted_at, status_changed_at, version, tab_id)
            select gen_random_uuid(), restaurant_id, created_at, created_by, table_id, menu_access_id,
                   gen_random_uuid(), business_day, $3::int + g, status, cancel_reason, cancel_note,
                   total, submitted_at, status_changed_at, version, tab_id
              from src, generate_series(1, $2::int) g
            returning id)
     insert into order_lines (id, restaurant_id, created_at, created_by, order_id, position, recipe_id,
                              recipe_version_id, quantity, base_price, unit_price)
     select gen_random_uuid(), l.restaurant_id, l.created_at, l.created_by, made.id, l.position, l.recipe_id,
            l.recipe_version_id, l.quantity, l.base_price, l.unit_price
       from made, order_lines l
      where l.order_id = $1`,
    [orderId, n, from],
  );
}

/** Spec 014, SC-005: Vendas de um dia com 500 pedidos abre rápido e não faz uma consulta por pedido. */
describe("relatório de vendas com muitos pedidos (spec 014, SC-005)", () => {
  let env: TestEnv;
  let counting: ReturnType<typeof countingEnv>;

  beforeEach(() => {
    env = testEnv();
    counting = countingEnv(env);
  });
  afterEach(async () => {
    await counting.close();
  });

  it("10 ou 500 pedidos de 3 linhas: mesmas idas ao banco, e menos de 2 s", async () => {
    const s = await cashScenario(env);
    await s.openSession();
    const order = await s.place("12", [s.burger(1, 2), s.burger(1), s.juice(2)]);
    const run = async () => {
      counting.take();
      const started = performance.now();
      const r = unwrap(await salesReport(counting.deps, s.m, { from: DAY, to: DAY }));
      return { r, trips: counting.take(), ms: performance.now() - started };
    };

    await copies(order.orderId, 9, 100);
    const few = await run();
    await copies(order.orderId, 490, 200);
    const many = await run();

    expect(many.r.products.find((p) => p.name === "X-Burger")?.quantity).toBe(1000);
    expect(many.trips).toBe(few.trips);
    expect(many.ms).toBeLessThan(2000);
  });
});
