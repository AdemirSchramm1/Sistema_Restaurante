import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, orderingScenario, scan, tablet, tableWithQr, unwrap } from "./fixtures";
import { getMenu } from "../../../src/application/ordering/menu";
import { releaseTablet, rotateTabletLink } from "../../../src/application/ordering/tablets";

/** Cardápio pelo tablet da mesa (spec 016, US4; FR-005, FR-011). */
const version = async (tableId: string) =>
  (
    await ownerTestDb().execute<{ version: number }>(
      sql`select version from dining_tables where id = ${tableId}`,
    )
  ).rows[0]!.version;

describe("cardápio do tablet (spec 016, US4)", () => {
  it("modo TABLET: sem prazo e sem limite de pedidos, e 400 dias depois ainda abre", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const cookie = await tablet(env, m, s.table.tableId);
    const menu = unwrap(await getMenu(env.deps, { qr: null, tablet: cookie }));
    expect(menu).toMatchObject({ mode: "TABLET", tableName: "12", expiresAt: null, ordersLeft: null });
    expect(menu.sections.flatMap((x) => x.products).map((p) => p.name)).toContain("X-Burger");
    env.clock.advance(400 * 24 * 60 * 60 * 1000);
    expect(unwrap(await getMenu(env.deps, { qr: null, tablet: cookie })).mode).toBe("TABLET");
  });

  it("com os dois cookies vale o do tablet; ler um QR code no tablet não encerra o tablet", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const tab = await tablet(env, m, s.table.tableId);
    const qr = await scan(env, s.table.token, s.cookie);
    expect(unwrap(await getMenu(env.deps, { qr, tablet: tab })).mode).toBe("TABLET");
    expect(unwrap(await getMenu(env.deps, { qr, tablet: null })).mode).toBe("QR");
    // O celular antigo do QR code acabou (RESCAN); o tablet segue.
    expect(code(await getMenu(env.deps, s.cookie))).toBe("ACCESS_EXPIRED");
    expect(code(await getMenu(env.deps, { qr: null, tablet: tab }))).toBe("OK");
  });

  it("liberado: TABLET_RELEASED; link trocado: TABLET_LINK_INVALID", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "3");
    const first = await tablet(env, m, t.tableId);
    unwrap(await releaseTablet(env.deps, m, { tableId: t.tableId }));
    expect(code(await getMenu(env.deps, { qr: null, tablet: first }))).toBe("TABLET_RELEASED");
    const second = await tablet(env, m, t.tableId);
    unwrap(await rotateTabletLink(env.deps, m, { tableId: t.tableId, version: await version(t.tableId) }));
    expect(code(await getMenu(env.deps, { qr: null, tablet: second }))).toBe("TABLET_LINK_INVALID");
  });

  it("mesa inativa: TABLE_INACTIVE; chave desligada: ORDERING_PAUSED", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "3");
    const cookie = await tablet(env, m, t.tableId);
    await ownerTestDb().execute(
      sql`update restaurants set accepting_qr_orders = false where id = ${m.restaurantId}`,
    );
    expect(code(await getMenu(env.deps, { qr: null, tablet: cookie }))).toBe("ORDERING_PAUSED");
    await ownerTestDb().execute(sql`update dining_tables set active = false where id = ${t.tableId}`);
    expect(code(await getMenu(env.deps, { qr: null, tablet: cookie }))).toBe("TABLE_INACTIVE");
  });

  it("nenhum dado de outra mesa ou de outro restaurante", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const other = await newRestaurant(env, "Outro");
    const t = await tableWithQr(env, m, "3");
    await tableWithQr(env, m, "4");
    const o = await tableWithQr(env, other, "9");
    const cookie = await tablet(env, m, t.tableId);
    await tablet(env, other, o.tableId);
    const menu = unwrap(await getMenu(env.deps, { qr: null, tablet: cookie }));
    expect(menu.tableName).toBe("3");
    expect(menu.restaurantName).not.toBe("Outro");
  });
});
