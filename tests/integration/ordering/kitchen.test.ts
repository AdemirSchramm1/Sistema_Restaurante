import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, orderingScenario, unwrap } from "./fixtures";
import {
  advanceOrderStatus,
  cancelOrder,
  listKitchenOrders,
  listReadyOrders,
  markDelivered,
} from "../../../src/application/ordering/kitchen";

const MIN = 60_000;

describe("cozinha e garçom (spec 009 US4 + spec 010 US4)", () => {
  it("cozinha vê os pedidos abertos, mais antigo primeiro, com as mudanças e o atraso", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const first = await s.place([s.burger(2)]);
    env.clock.advance(5 * MIN);
    await s.place([s.juice()]);
    env.clock.advance(16 * MIN);

    const board = unwrap(await listKitchenOrders(env.deps, m));
    expect(board.serverNow).toBe(env.clock.now().toISOString());
    expect(board.orders.map((o) => [o.number, o.tableName, o.status, o.late])).toEqual([
      [1, "12", "RECEIVED", true],
      [2, "12", "RECEIVED", false],
    ]);
    expect(board.orders[0]).toMatchObject({ id: first.orderId, version: 1 });
    expect(board.orders[0]!.lines).toEqual([
      { quantity: 2, productName: "X-Burger", changes: ["+ 2 Fatia de queijo", "SEM cebola"] },
    ]);
  });

  it("avança Recebido → Em preparo → Pronto → Entregue, com trava e eventos de quem fez", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const chef = await addMember(env, m, ["CHEF"], "Chef Ana");
    const waiter = await addMember(env, m, ["WAITER"], "Garçom Beto");
    const { orderId: id } = await s.place([s.juice()]);

    expect(code(await advanceOrderStatus(env.deps, chef, { id, to: "READY", version: 1 }))).toBe(
      "INVALID_ORDER_TRANSITION",
    );
    unwrap(await advanceOrderStatus(env.deps, chef, { id, to: "PREPARING", version: 1 }));
    expect(code(await advanceOrderStatus(env.deps, chef, { id, to: "READY", version: 1 }))).toBe(
      "STALE_RECORD",
    );
    expect(code(await advanceOrderStatus(env.deps, waiter, { id, to: "READY", version: 2 }))).toBe(
      "FORBIDDEN",
    );
    env.clock.advance(MIN);
    unwrap(await advanceOrderStatus(env.deps, chef, { id, to: "READY", version: 2 }));

    const ready = unwrap(await listReadyOrders(env.deps, waiter));
    expect(ready).toEqual([
      expect.objectContaining({ id, number: 1, tableName: "12", version: 3, readyAt: env.clock.now() }),
    ]);
    expect(unwrap(await listKitchenOrders(env.deps, chef)).orders.map((o) => o.status)).toEqual(["READY"]);

    unwrap(await markDelivered(env.deps, waiter, { id, version: 3 }));
    expect(unwrap(await listReadyOrders(env.deps, waiter))).toEqual([]);
    expect(unwrap(await listKitchenOrders(env.deps, chef)).orders).toEqual([]);
    expect(code(await markDelivered(env.deps, waiter, { id, version: 4 }))).toBe("INVALID_ORDER_TRANSITION");
    expect(code(await markDelivered(env.deps, waiter, { id: crypto.randomUUID(), version: 1 }))).toBe(
      "NOT_FOUND",
    );

    const events = await ownerTestDb().$client.query<{
      from_status: string | null;
      to_status: string;
      user_id: string | null;
    }>(
      "select from_status, to_status, user_id from order_status_events where order_id = $1 order by at, id",
      [id],
    );
    expect(events.rows).toEqual([
      { from_status: null, to_status: "RECEIVED", user_id: null },
      { from_status: "RECEIVED", to_status: "PREPARING", user_id: chef.userId },
      { from_status: "PREPARING", to_status: "READY", user_id: chef.userId },
      { from_status: "READY", to_status: "DELIVERED", user_id: waiter.userId },
    ]);
  });

  it("cancela com motivo; 'Outro' pede o texto; pedido final não muda", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const chef = await addMember(env, m, ["CHEF"]);
    const { orderId: id } = await s.place([s.juice()]);
    expect(code(await cancelOrder(env.deps, chef, { id, reason: "OTHER", note: " ", version: 1 }))).toBe(
      "CANCEL_NOTE_REQUIRED",
    );
    expect(
      code(await cancelOrder(env.deps, chef, { id, reason: "OTHER", note: "x".repeat(141), version: 1 })),
    ).toBe("NOTE_TOO_LONG");
    unwrap(await cancelOrder(env.deps, chef, { id, reason: "OUT_OF_PRODUCT", note: null, version: 1 }));
    expect(
      code(await cancelOrder(env.deps, chef, { id, reason: "OTHER", note: "de novo", version: 2 })),
    ).toBe("INVALID_ORDER_TRANSITION");
    const row = await ownerTestDb().$client.query("select status, cancel_reason from orders where id = $1", [
      id,
    ]);
    expect(row.rows[0]).toEqual({ status: "CANCELLED", cancel_reason: "OUT_OF_PRODUCT" });
    const ev = await ownerTestDb().$client.query(
      "select reason, user_id from order_status_events where order_id = $1 and to_status = 'CANCELLED'",
      [id],
    );
    expect(ev.rows).toEqual([{ reason: "OUT_OF_PRODUCT", user_id: chef.userId }]);
    expect(unwrap(await listKitchenOrders(env.deps, chef)).orders).toEqual([]);
  });

  it("estoquista não vê nada; garçom não vê a cozinha nem cancela", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const stock = await addMember(env, m, ["STOCKKEEPER"]);
    const waiter = await addMember(env, m, ["WAITER"]);
    const { orderId: id } = await s.place([s.juice()]);
    expect(code(await listKitchenOrders(env.deps, stock))).toBe("FORBIDDEN");
    expect(code(await listReadyOrders(env.deps, stock))).toBe("FORBIDDEN");
    expect(code(await listKitchenOrders(env.deps, waiter))).toBe("FORBIDDEN");
    expect(
      code(await cancelOrder(env.deps, waiter, { id, reason: "OUT_OF_PRODUCT", note: null, version: 1 })),
    ).toBe("FORBIDDEN");
  });
});
