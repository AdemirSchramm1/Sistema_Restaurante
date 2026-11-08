import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, orderingScenario, scan, unwrap } from "./fixtures";
import {
  getOrder,
  getOrderingSettings,
  listOrders,
  setAcceptingQrOrders,
} from "../../../src/application/ordering/orders";
import { advanceOrderStatus, cancelOrder } from "../../../src/application/ordering/kitchen";
import { openMenuAccess } from "../../../src/application/ordering/menu-access";

describe("chave de pedidos e consulta (spec 009, US6)", () => {
  it("gerente desliga e liga a chave, com trava e auditoria", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const chef = await addMember(env, m, ["CHEF"]);
    const settings = unwrap(await getOrderingSettings(env.deps, m));
    expect(settings).toMatchObject({ acceptingQrOrders: true });
    expect(code(await setAcceptingQrOrders(env.deps, chef, { accepting: false, version: settings.version }))).toBe(
      "FORBIDDEN",
    );
    unwrap(await setAcceptingQrOrders(env.deps, m, { accepting: false, version: settings.version }));
    expect(code(await setAcceptingQrOrders(env.deps, m, { accepting: true, version: settings.version }))).toBe(
      "STALE_RECORD",
    );
    expect(
      code(await openMenuAccess(env.deps, { qrToken: s.table.token, previousCookie: null, origin: { ip: null, userAgent: null } })),
    ).toBe("ORDERING_PAUSED");
    const audit = await ownerTestDb().$client.query(
      "select entity, changes from audit_log where restaurant_id = $1 and changes ? 'acceptingQrOrders'",
      [m.restaurantId],
    );
    expect(audit.rows).toEqual([{ entity: "restaurant", changes: { acceptingQrOrders: [true, false] } }]);
  });

  it("lista pedidos do período, por mesa e situação, e mostra um pedido com os eventos", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const waiter = await addMember(env, m, ["WAITER"], "Garçom Beto");
    const a = await s.place([s.burger(2)]);
    const b = await s.place([s.juice()]);
    unwrap(await advanceOrderStatus(env.deps, m, { id: a.orderId, to: "PREPARING", version: 1 }));
    unwrap(await cancelOrder(env.deps, m, { id: b.orderId, reason: "CUSTOMER_GAVE_UP", note: null, version: 1 }));
    env.clock.advance(24 * 3600_000);
    const next = await scan(env, s.table.token);
    const { submitOrder } = await import("../../../src/application/ordering/submit-order");
    unwrap(await submitOrder(env.deps, next, { clientRequestId: crypto.randomUUID(), lines: [s.juice()] }));

    const day1 = unwrap(await listOrders(env.deps, waiter, { from: "2026-10-31", to: "2026-10-31" }));
    expect(day1.map((o) => [o.number, o.tableName, o.status, o.total])).toEqual([
      [2, "12", "CANCELLED", "9.00"],
      [1, "12", "PREPARING", "68.00"],
    ]);
    const both = unwrap(await listOrders(env.deps, m, { from: "2026-10-31", to: "2026-11-01" }));
    expect(both.map((o) => [o.businessDay, o.number])).toEqual([
      ["2026-11-01", 1],
      ["2026-10-31", 2],
      ["2026-10-31", 1],
    ]);
    expect(
      unwrap(await listOrders(env.deps, m, { from: "2026-10-31", to: "2026-11-01", status: "CANCELLED" })).map((o) => o.number),
    ).toEqual([2]);
    expect(
      unwrap(await listOrders(env.deps, m, { from: "2026-10-31", to: "2026-11-01", tableId: crypto.randomUUID() })),
    ).toEqual([]);
    expect(code(await listOrders(env.deps, m, { from: "2026-11-02", to: "2026-11-01" }))).toBe("INVALID_PERIOD");
    expect(code(await listOrders(env.deps, m, { from: "2026-10-01", to: "2026-11-01" }))).toBe("INVALID_PERIOD");
    expect(code(await listOrders(env.deps, m, { from: "ontem", to: "2026-11-01" }))).toBe("INVALID_PERIOD");

    const one = unwrap(await getOrder(env.deps, waiter, b.orderId));
    expect(one).toMatchObject({ number: 2, status: "CANCELLED", cancelReason: "CUSTOMER_GAVE_UP", tableName: "12" });
    expect(one.lines).toEqual([{ quantity: 1, productName: "Suco", unitPrice: "9.00", changes: [] }]);
    expect(one.events.map((e) => [e.fromStatus, e.toStatus, e.userName])).toEqual([
      [null, "RECEIVED", null],
      ["RECEIVED", "CANCELLED", "Gerente"],
    ]);
    expect(code(await getOrder(env.deps, waiter, crypto.randomUUID()))).toBe("NOT_FOUND");
    const stock = await addMember(env, m, ["STOCKKEEPER"]);
    expect(code(await listOrders(env.deps, stock, { from: "2026-10-31", to: "2026-10-31" }))).toBe("FORBIDDEN");
  });
});
