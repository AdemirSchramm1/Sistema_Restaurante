import { describe, it, expect } from "vitest";
import { newRestaurant, ownerTestDb, testEnv, type TestEnv } from "../harness";
import { code, orderingKitchen, scan, tableWithQr, unwrap } from "./fixtures";
import { submitOrder } from "../../../src/application/ordering/submit-order";
import { listAccessOrders } from "../../../src/application/ordering/menu";
import { createAddon, setAddonActive, updateAddon } from "../../../src/application/ordering/addons";
import { setProductCustomization } from "../../../src/application/ordering/customization";
import { setTableActive } from "../../../src/application/ordering/tables";
import { setRecipeSalePrice } from "../../../src/application/inventory/product-costs";
import type { RequestContext } from "../../../src/application/context";
import { d } from "../../../src/domain/shared/decimal";

const MIN = 60_000;

/** Mesa 5 com X-Burger (+ Fatia de queijo até 2, "Sem cebola") e Suco; um celular com acesso aberto. */
async function setup(env: TestEnv, m: RequestContext) {
  const k = await orderingKitchen(env, m);
  const cheese = unwrap(
    await createAddon(env.deps, m, {
      name: "Fatia de queijo",
      component: { kind: "ITEM", id: k.queijo },
      quantity: d("20"),
      unit: "g",
      price: d("3.00"),
    }),
  ).id;
  unwrap(
    await setProductCustomization(env.deps, m, {
      recipeId: k.burger,
      version: 2,
      addons: [{ addonId: cheese, maxTimes: 2 }],
      removables: [{ component: { kind: "ITEM", id: k.cebola } }],
    }),
  );
  const table = await tableWithQr(env, m, "5");
  const cookie = await scan(env, table.token);
  const burgerLine = (over: Record<string, unknown> = {}) => ({
    recipeId: k.burger,
    quantity: 2,
    unitPrice: "34.00",
    addons: [{ addonId: cheese, times: 2, unitPrice: "3.00" }],
    removals: [{ kind: "ITEM", id: k.cebola }],
    ...over,
  });
  const juiceLine = { recipeId: k.suco, quantity: 1, unitPrice: "9.00", addons: [], removals: [] };
  return { ...k, cheese, table, cookie, burgerLine, juiceLine };
}

const order = (lines: unknown[], clientRequestId: string = crypto.randomUUID()) => ({
  clientRequestId,
  lines,
});

describe("enviar pedido (spec 009 US2 + spec 010 US3)", () => {
  it("grava o pedido, as linhas com a versão e as escolhas copiadas, e o evento", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await setup(env, m);
    const r = unwrap(await submitOrder(env.deps, s.cookie, order([s.burgerLine(), s.juiceLine])));
    expect(r).toEqual({ orderId: expect.any(String), number: 1, total: "77.00", status: "RECEIVED" });

    const db = ownerTestDb().$client;
    const o = await db.query("select status, total, business_day::text, table_id from orders where id = $1", [
      r.orderId,
    ]);
    expect(o.rows[0]).toMatchObject({
      status: "RECEIVED",
      total: "77.00",
      business_day: "2026-10-31",
      table_id: s.table.tableId,
    });
    const lines = await db.query(
      `select l.id, l.quantity, l.base_price, l.unit_price, l.recipe_version_id = (
         select id from recipe_versions v where v.recipe_id = l.recipe_id order by number desc limit 1) as latest
       from order_lines l where order_id = $1 order by position`,
      [r.orderId],
    );
    expect(lines.rows.map((x) => [x.quantity, x.base_price, x.unit_price, x.latest])).toEqual([
      [2, "28.00", "34.00", true],
      [1, "9.00", "9.00", true],
    ]);
    const addons = await db.query(
      "select name, times, unit_price, item_id, quantity, unit_id is not null as has_unit from order_line_addons where order_line_id = $1",
      [lines.rows[0].id],
    );
    expect(addons.rows).toEqual([
      {
        name: "Fatia de queijo",
        times: 2,
        unit_price: "3.00",
        item_id: s.queijo,
        quantity: "20.0000",
        has_unit: true,
      },
    ]);
    const removals = await db.query(
      "select item_id, label from order_line_removals where order_line_id = $1",
      [lines.rows[0].id],
    );
    expect(removals.rows).toEqual([{ item_id: s.cebola, label: "Sem cebola" }]);
    const events = await db.query(
      "select from_status, to_status, user_id from order_status_events where order_id = $1",
      [r.orderId],
    );
    expect(events.rows).toEqual([{ from_status: null, to_status: "RECEIVED", user_id: null }]);

    const mine = unwrap(await listAccessOrders(env.deps, s.cookie));
    expect(mine[0]!.lines).toEqual([
      { quantity: 2, productName: "X-Burger", changes: ["+ 2 Fatia de queijo", "SEM cebola"] },
      { quantity: 1, productName: "Suco", changes: [] },
    ]);
  });

  it("o mesmo clientRequestId devolve o mesmo pedido (toque duplo)", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await setup(env, m);
    const id = crypto.randomUUID();
    const a = unwrap(await submitOrder(env.deps, s.cookie, order([s.juiceLine], id)));
    const b = unwrap(await submitOrder(env.deps, s.cookie, order([s.juiceLine], id)));
    expect(b).toEqual(a);
    const n = await ownerTestDb().$client.query(
      "select count(*)::int as n from orders where restaurant_id = $1",
      [m.restaurantId],
    );
    expect(n.rows[0].n).toBe(1);
  });

  it("número do dia 1, 2, 3; dois envios ao mesmo tempo não repetem; recomeça no dia seguinte", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await setup(env, m);
    expect(unwrap(await submitOrder(env.deps, s.cookie, order([s.juiceLine]))).number).toBe(1);
    const [x, y] = await Promise.all([
      submitOrder(env.deps, s.cookie, order([s.juiceLine])),
      submitOrder(env.deps, s.cookie, order([s.juiceLine])),
    ]);
    expect([unwrap(x).number, unwrap(y).number].sort()).toEqual([2, 3]);
    env.clock.advance(24 * 60 * MIN);
    const next = await scan(env, s.table.token);
    expect(unwrap(await submitOrder(env.deps, next, order([s.juiceLine]))).number).toBe(1);
  });

  it("aceita até 15 s depois do prazo; depois disso pede para escanear de novo", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await setup(env, m);
    env.clock.advance(20 * MIN + 15_000);
    expect(code(await submitOrder(env.deps, s.cookie, order([s.juiceLine])))).toBe("OK");
    env.clock.advance(1);
    expect(code(await submitOrder(env.deps, s.cookie, order([s.juiceLine])))).toBe("ACCESS_EXPIRED");
    expect(code(await submitOrder(env.deps, null, order([s.juiceLine])))).toBe("ACCESS_EXPIRED");
  });

  it("mesa inativa, chave desligada e limite de 10 pedidos por acesso", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await setup(env, m);
    for (let i = 0; i < 10; i++) unwrap(await submitOrder(env.deps, s.cookie, order([s.juiceLine])));
    expect(code(await submitOrder(env.deps, s.cookie, order([s.juiceLine])))).toBe("ACCESS_ORDER_LIMIT");

    const other = await scan(env, s.table.token);
    await ownerTestDb().$client.query("update restaurants set accepting_qr_orders = false where id = $1", [
      m.restaurantId,
    ]);
    expect(code(await submitOrder(env.deps, other, order([s.juiceLine])))).toBe("ORDERING_PAUSED");
    unwrap(await setTableActive(env.deps, m, { id: s.table.tableId, active: false, version: 1 }));
    expect(code(await submitOrder(env.deps, other, order([s.juiceLine])))).toBe("TABLE_INACTIVE");
  });

  it("linhas inválidas: vazio, quantidade fora de 1 a 20, entrada malformada", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await setup(env, m);
    expect(code(await submitOrder(env.deps, s.cookie, order([])))).toBe("EMPTY_ORDER");
    expect(code(await submitOrder(env.deps, s.cookie, order([{ ...s.juiceLine, quantity: 21 }])))).toBe(
      "INVALID_QUANTITY",
    );
    expect(code(await submitOrder(env.deps, s.cookie, { clientRequestId: "x", lines: [] }))).toBe(
      "VALIDATION",
    );
    expect(code(await submitOrder(env.deps, s.cookie, order([{ ...s.juiceLine, note: "sem gelo" }])))).toBe(
      "VALIDATION",
    );
  });

  it("produto esgotado ou adicional inativo: nada é gravado e a resposta diz qual", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await setup(env, m);
    await ownerTestDb().$client.query("update recipes set sold_out_on = '2026-10-31' where id = $1", [
      s.suco,
    ]);
    const r = await submitOrder(env.deps, s.cookie, order([s.burgerLine(), s.juiceLine]));
    expect(r.ok ? null : r.error).toMatchObject({
      code: "PRODUCT_UNAVAILABLE",
      details: { recipeIds: [s.suco] },
    });

    unwrap(await setAddonActive(env.deps, m, { id: s.cheese, active: false, version: 1 }));
    const r2 = await submitOrder(env.deps, s.cookie, order([s.burgerLine()]));
    expect(r2.ok ? null : r2.error).toMatchObject({
      code: "PRODUCT_UNAVAILABLE",
      details: { addonIds: [s.cheese] },
    });
    const n = await ownerTestDb().$client.query(
      "select count(*)::int as n from orders where restaurant_id = $1",
      [m.restaurantId],
    );
    expect(n.rows[0].n).toBe(0);
  });

  it("preço mudado do produto ou do adicional: devolve os preços novos", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await setup(env, m);
    unwrap(await setRecipeSalePrice(env.deps, m, s.suco, 2, d("10.00")));
    const r = await submitOrder(env.deps, s.cookie, order([s.juiceLine]));
    expect(r.ok ? null : r.error).toMatchObject({
      code: "PRICE_CHANGED",
      details: { prices: [{ recipeId: s.suco, price: "10.00" }], addonPrices: [] },
    });

    unwrap(
      await updateAddon(env.deps, m, {
        id: s.cheese,
        version: 1,
        name: "Fatia de queijo",
        component: { kind: "ITEM", id: s.queijo },
        quantity: d("20"),
        unit: "g",
        price: d("3.50"),
      }),
    );
    const r2 = await submitOrder(env.deps, s.cookie, order([s.burgerLine()]));
    expect(r2.ok ? null : r2.error).toMatchObject({
      code: "PRICE_CHANGED",
      details: { addonPrices: [{ addonId: s.cheese, price: "3.50" }] },
    });
  });

  it("retirada que saiu do quadro: OPTION_UNAVAILABLE", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await setup(env, m);
    unwrap(
      await setProductCustomization(env.deps, m, {
        recipeId: s.burger,
        version: 3,
        addons: [{ addonId: s.cheese, maxTimes: 2 }],
        removables: [],
      }),
    );
    expect(code(await submitOrder(env.deps, s.cookie, order([s.burgerLine()])))).toBe("OPTION_UNAVAILABLE");
    expect(
      code(
        await submitOrder(
          env.deps,
          s.cookie,
          order([
            s.burgerLine({ addons: [{ addonId: s.cheese, times: 3, unitPrice: "3.00" }], removals: [] }),
          ]),
        ),
      ),
    ).toBe("INVALID_ADDON_TIMES");
  });

  it("pedido enviado não muda quando o adicional muda depois", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await setup(env, m);
    unwrap(await submitOrder(env.deps, s.cookie, order([s.burgerLine()])));
    unwrap(
      await updateAddon(env.deps, m, {
        id: s.cheese,
        version: 1,
        name: "Queijo extra",
        component: { kind: "ITEM", id: s.queijo },
        quantity: d("40"),
        unit: "g",
        price: d("5.00"),
      }),
    );
    const mine = unwrap(await listAccessOrders(env.deps, s.cookie));
    expect(mine[0]!.lines[0]!.changes).toEqual(["+ 2 Fatia de queijo", "SEM cebola"]);
    expect(mine[0]!.total).toBe("68.00");
  });
});
