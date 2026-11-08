import { describe, it, expect } from "vitest";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, orderingKitchen, scan, tableWithQr, unwrap } from "./fixtures";
import { openMenuAccess } from "../../../src/application/ordering/menu-access";
import { getMenu } from "../../../src/application/ordering/menu";
import { setTableActive } from "../../../src/application/ordering/tables";

const MIN = 60_000;
const origin = { ip: "203.0.113.7", userAgent: "Celular de teste" };

describe("acesso ao cardápio de 20 minutos (spec 009, US3)", () => {
  it("cada leitura do QR code abre 20 minutos, com IP e navegador; usar não renova", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    await orderingKitchen(env, m);
    const { token, tableId } = await tableWithQr(env, m, "5");
    const opened = unwrap(await openMenuAccess(env.deps, { qrToken: token, previousCookie: null, origin }));
    expect(opened.expiresAt.getTime() - env.clock.now().getTime()).toBe(20 * MIN);
    expect(opened.cookie).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const row = await ownerTestDb().$client.query(
      "select table_id, ip, user_agent, token_hash, ended_at from menu_accesses where restaurant_id = $1",
      [m.restaurantId],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]).toMatchObject({
      table_id: tableId,
      ip: "203.0.113.7",
      user_agent: "Celular de teste",
      ended_at: null,
    });
    expect(row.rows[0].token_hash).not.toBe(opened.cookie);

    env.clock.advance(19 * MIN + 59_000);
    const menu = unwrap(await getMenu(env.deps, opened.cookie));
    expect(menu.expiresAt).toBe(opened.expiresAt.toISOString());
    expect(menu.serverNow).toBe(env.clock.now().toISOString());
    env.clock.advance(1_000);
    expect(code(await getMenu(env.deps, opened.cookie))).toBe("ACCESS_EXPIRED");
  });

  it("nova leitura no mesmo celular encerra o acesso anterior", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const { token } = await tableWithQr(env, m, "5");
    const first = await scan(env, token);
    const second = await scan(env, token, first);
    expect(code(await getMenu(env.deps, first))).toBe("ACCESS_EXPIRED");
    expect(code(await getMenu(env.deps, second))).toBe("OK");
    const ended = await ownerTestDb().$client.query(
      "select count(*)::int as n from menu_accesses where restaurant_id = $1 and ended_at is not null",
      [m.restaurantId],
    );
    expect(ended.rows[0].n).toBe(1);
  });

  it("mesa inativa, chave desligada e token desconhecido não abrem acesso", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const { token, tableId } = await tableWithQr(env, m, "5");
    expect(
      code(await openMenuAccess(env.deps, { qrToken: "nao-existe", previousCookie: null, origin })),
    ).toBe("NOT_FOUND");
    await ownerTestDb().$client.query("update restaurants set accepting_qr_orders = false where id = $1", [
      m.restaurantId,
    ]);
    expect(code(await openMenuAccess(env.deps, { qrToken: token, previousCookie: null, origin }))).toBe(
      "ORDERING_PAUSED",
    );
    await ownerTestDb().$client.query("update restaurants set accepting_qr_orders = true where id = $1", [
      m.restaurantId,
    ]);
    unwrap(await setTableActive(env.deps, m, { id: tableId, active: false, version: 1 }));
    expect(code(await openMenuAccess(env.deps, { qrToken: token, previousCookie: null, origin }))).toBe(
      "TABLE_INACTIVE",
    );
    const n = await ownerTestDb().$client.query(
      "select count(*)::int as n from menu_accesses where restaurant_id = $1",
      [m.restaurantId],
    );
    expect(n.rows[0].n).toBe(0);
  });

  it("sem cookie ou com cookie desconhecido o cardápio pede para escanear de novo", async () => {
    const env = testEnv();
    expect(code(await getMenu(env.deps, null))).toBe("ACCESS_EXPIRED");
    expect(code(await getMenu(env.deps, "qualquer-coisa"))).toBe("ACCESS_EXPIRED");
  });
});
