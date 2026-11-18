import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { ownerTestDb, testEnv } from "../harness";
import { tablet, unwrap } from "./fixtures";
import { billingScenario } from "../billing/fixtures";
import { tabletStatusResponse } from "../../../src/actions/_tablet";
import { submitOrder } from "../../../src/application/ordering/submit-order";
import { renameTable } from "../../../src/application/ordering/tables";
import { releaseTablet, rotateTabletLink } from "../../../src/application/ordering/tablets";
import { setAcceptingQrOrders } from "../../../src/application/ordering/orders";
import { setAppearanceImage } from "../../../src/application/menu/appearance";
import { readFile } from "node:fs/promises";

/** Sinal do tablet: `GET /api/cardapio/tablet` (spec 016, US4; research R5). */
const version = async (table: "dining_tables" | "restaurants", id: string) =>
  (
    await ownerTestDb().execute<{ version: number }>(
      sql`select version from ${sql.raw(table)} where id = ${id}`,
    )
  ).rows[0]!.version;

async function setup() {
  const env = testEnv();
  const b = await billingScenario(env);
  const tableId = b.s.table.tableId;
  const cookie = await tablet(env, b.m, tableId);
  const status = async (c: string | null = cookie) => {
    const res = await tabletStatusResponse(env.deps, c);
    return { res, body: (await res.json()) as Record<string, unknown> };
  };
  const send = () =>
    submitOrder(env.deps, { qr: null, tablet: cookie }, { clientRequestId: crypto.randomUUID(), lines: [b.s.juice()] });
  return { env, b, tableId, cookie, status, send };
}

describe("GET /api/cardapio/tablet (spec 016, US4)", () => {
  it("sem cookie ou cookie desconhecido: 401 UNKNOWN, sem cache", async () => {
    const env = testEnv();
    for (const c of [null, "nao-existe"]) {
      const res = await tabletStatusResponse(env.deps, c);
      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toEqual({ state: "UNKNOWN" });
    }
  });

  it("ligado: OK com a mesa, a conta aberta e o stamp", async () => {
    const { status, send, b } = await setup();
    const before = await status();
    expect(before.res.status).toBe(200);
    expect(before.res.headers.get("cache-control")).toBe("no-store");
    expect(before.body).toMatchObject({ state: "OK", tableName: "12", tabId: null });
    expect(typeof before.body.stamp).toBe("string");
    unwrap(await send());
    const after = await status();
    expect(after.body.tabId).toBe(await b.tabId());
    expect(after.body.stamp).not.toBe(before.body.stamp);
  });

  it("o stamp muda com nome da mesa, pedido, aparência e chave; e não muda sem nada", async () => {
    const { env, b, tableId, status, send } = await setup();
    const stamp = async () => (await status()).body.stamp;
    let last = await stamp();
    expect(await stamp()).toBe(last);
    const changed = async () => {
      const now = await stamp();
      expect(now).not.toBe(last);
      last = now;
    };

    unwrap(await renameTable(env.deps, b.m, { id: tableId, name: "12A", version: await version("dining_tables", tableId) }));
    await changed();
    const order = unwrap(await send());
    await changed();
    await b.advance(order.orderId, "PREPARING");
    await changed();
    const logo = new Uint8Array(await readFile("tests/screens/photos/logo.png"));
    unwrap(await setAppearanceImage(env.deps, b.m, { kind: "LOGO", bytes: logo }));
    await changed();
    unwrap(
      await setAcceptingQrOrders(env.deps, b.m, {
        accepting: false,
        version: await version("restaurants", b.m.restaurantId),
      }),
    );
    const paused = await status();
    expect(paused.body.state).toBe("ORDERING_PAUSED");
    expect(paused.body.stamp).not.toBe(last);
  });

  it("mesa inativa, liberado e link trocado", async () => {
    const { env, b, tableId, status } = await setup();
    await ownerTestDb().execute(sql`update dining_tables set active = false where id = ${tableId}`);
    expect((await status()).body.state).toBe("TABLE_INACTIVE");
    await ownerTestDb().execute(sql`update dining_tables set active = true where id = ${tableId}`);
    unwrap(await releaseTablet(env.deps, b.m, { tableId }));
    expect((await status()).body).toMatchObject({ state: "RELEASED" });
    const again = await tablet(env, b.m, tableId);
    unwrap(await rotateTabletLink(env.deps, b.m, { tableId, version: await version("dining_tables", tableId) }));
    expect((await status(again)).body).toMatchObject({ state: "LINK_ROTATED" });
  });

  it("grava o visto por último no máximo uma vez por minuto", async () => {
    const { env, b, tableId, status } = await setup();
    const seen = async () =>
      (
        await ownerTestDb().execute<{ s: string | null }>(
          sql`select last_seen_at::text as s from menu_accesses where table_id = ${tableId} and kind = 'TABLET'`,
        )
      ).rows[0]!.s;
    await status();
    const first = await seen();
    expect(first).not.toBeNull();
    env.clock.advance(30_000);
    await status();
    expect(await seen()).toBe(first);
    env.clock.advance(31_000);
    await status();
    expect(await seen()).not.toBe(first);
    void b;
  });

  it("cookie de celular (QR code) não é tablet: 401", async () => {
    const { env, b } = await setup();
    const res = await tabletStatusResponse(env.deps, b.s.cookie);
    expect(res.status).toBe(401);
  });
});
