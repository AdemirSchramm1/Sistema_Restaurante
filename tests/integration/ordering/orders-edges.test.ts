import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, orderingScenario, unwrap } from "./fixtures";
import {
  getOrder,
  getOrderingSettings,
  ordersBySource,
  setAcceptingQrOrders,
} from "../../../src/application/ordering/orders";

/** Spec 018, US3: recusas da consulta de pedidos e da chave do QR code (pedidos/04) que faltavam. */

describe("consulta de pedidos e chave do QR code: recusas", () => {
  it("quem não vê pedidos nem mexe na chave recebe FORBIDDEN", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const { orderId } = await s.place([s.juice()]);
    const stock = await addMember(env, m, ["STOCKKEEPER"]);
    expect(code(await getOrderingSettings(env.deps, stock))).toBe("FORBIDDEN");
    expect(code(await getOrder(env.deps, stock, orderId))).toBe("FORBIDDEN");
    expect(code(await ordersBySource(env.deps, stock, { from: "2026-01-01", to: "2026-01-02" }))).toBe(
      "FORBIDDEN",
    );
  });

  it("ligar a chave que já está ligada não grava auditoria", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = unwrap(await getOrderingSettings(env.deps, m));
    unwrap(await setAcceptingQrOrders(env.deps, m, { accepting: s.acceptingQrOrders, version: s.version }));
    const audit = await ownerTestDb().$client.query(
      "select 1 from audit_log where entity = 'restaurant' and entity_id = $1 and changes ? 'acceptingQrOrders'",
      [m.restaurantId],
    );
    expect(audit.rowCount).toBe(0);
    expect(unwrap(await getOrderingSettings(env.deps, m)).version).toBe(s.version + 1);
  });
});
