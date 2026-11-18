import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, tableWithQr, unwrap } from "./fixtures";
import {
  createTabletLink,
  listTabletStatus,
  releaseTablet,
  rotateTabletLink,
} from "../../../src/application/ordering/tablets";
import { bindTablet } from "../../../src/application/ordering/menu-access";
import { countingEnv } from "../performance/counting";

/** Tablet da mesa, lado da equipe (spec 016, US4; contracts "Tablet da mesa — equipe"). */
const tableRow = async (id: string) =>
  (
    await ownerTestDb().execute<{ tablet_token: string | null; qr_token: string; version: number }>(
      sql`select tablet_token, qr_token, version from dining_tables where id = ${id}`,
    )
  ).rows[0]!;
const tabletAudit = async (restaurantId: string) =>
  (
    await ownerTestDb().execute<{ entity_id: string; changes: Record<string, unknown>; user_id: string | null }>(
      sql`select entity_id, changes, user_id from audit_log
          where restaurant_id = ${restaurantId} and changes ? 'tablet' order by occurred_at, id`,
    )
  ).rows;
const accessRow = async (tableId: string) =>
  (
    await ownerTestDb().execute<{ end_reason: string | null; kind: string }>(
      sql`select end_reason, kind from menu_accesses where table_id = ${tableId} and kind = 'TABLET' order by opened_at`,
    )
  ).rows;

const bind = async (env: ReturnType<typeof testEnv>, token: string, cookie: string | null = null) =>
  bindTablet(env.deps, {
    tabletToken: token,
    cookie,
    origin: { ip: "203.0.113.9", userAgent: "Tablet de teste" },
  });

describe("link do tablet da mesa (spec 016, US4)", () => {
  it("criar link: token de 43 caracteres, diferente do QR code, e auditoria sem o token", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "12");
    expect(code(await createTabletLink(env.deps, m, { tableId: t.tableId, version: 1 }))).toBe("OK");
    const row = await tableRow(t.tableId);
    expect(row.tablet_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(row.tablet_token).not.toBe(row.qr_token);
    expect(row.version).toBe(2);
    expect(await tabletAudit(m.restaurantId)).toEqual([
      { entity_id: t.tableId, changes: { tablet: "link_created" }, user_id: m.userId },
    ]);
    expect(code(await createTabletLink(env.deps, m, { tableId: t.tableId, version: 2 }))).toBe("NO_CHANGE");
  });

  it("versão velha: STALE_RECORD; mesa de outro restaurante: NOT_FOUND", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const other = await newRestaurant(env, "Outro");
    const t = await tableWithQr(env, m, "12");
    const elsewhere = await tableWithQr(env, other, "1");
    await ownerTestDb().execute(sql`update dining_tables set version = 3 where id = ${t.tableId}`);
    expect(code(await createTabletLink(env.deps, m, { tableId: t.tableId, version: 1 }))).toBe("STALE_RECORD");
    expect(code(await createTabletLink(env.deps, m, { tableId: elsewhere.tableId, version: 1 }))).toBe("NOT_FOUND");
  });

  it("liberar encerra o tablet ligado com RELEASED; sem tablet, NO_CHANGE", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "12");
    expect(code(await releaseTablet(env.deps, m, { tableId: t.tableId }))).toBe("NO_CHANGE");
    unwrap(await createTabletLink(env.deps, m, { tableId: t.tableId, version: 1 }));
    const token = (await tableRow(t.tableId)).tablet_token!;
    expect((await bind(env, token)).kind).toBe("BOUND");
    expect(code(await releaseTablet(env.deps, m, { tableId: t.tableId }))).toBe("OK");
    expect(await accessRow(t.tableId)).toEqual([{ end_reason: "RELEASED", kind: "TABLET" }]);
    expect((await tabletAudit(m.restaurantId)).map((a) => a.changes)).toEqual([
      { tablet: "link_created" },
      { tablet: "bound" },
      { tablet: "released" },
    ]);
    // Depois de liberar, o próximo aparelho liga.
    expect((await bind(env, token)).kind).toBe("BOUND");
  });

  it("trocar o link: token novo e o tablet ligado encerrado com LINK_ROTATED", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "12");
    expect(code(await rotateTabletLink(env.deps, m, { tableId: t.tableId, version: 1 }))).toBe("NOT_FOUND");
    unwrap(await createTabletLink(env.deps, m, { tableId: t.tableId, version: 1 }));
    const old = (await tableRow(t.tableId)).tablet_token!;
    await bind(env, old);
    expect(code(await rotateTabletLink(env.deps, m, { tableId: t.tableId, version: 2 }))).toBe("OK");
    const fresh = (await tableRow(t.tableId)).tablet_token!;
    expect(fresh).not.toBe(old);
    expect(await accessRow(t.tableId)).toEqual([{ end_reason: "LINK_ROTATED", kind: "TABLET" }]);
    expect((await tabletAudit(m.restaurantId)).at(-1)!.changes).toEqual({ tablet: "link_rotated" });
    expect(code(await rotateTabletLink(env.deps, m, { tableId: t.tableId, version: 2 }))).toBe("STALE_RECORD");
  });

  it("situação: link, ligado desde, visto há e o total de ligados, numa consulta só", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t12 = await tableWithQr(env, m, "12");
    const t4 = await tableWithQr(env, m, "4");
    unwrap(await createTabletLink(env.deps, m, { tableId: t12.tableId, version: 1 }));
    const token = (await tableRow(t12.tableId)).tablet_token!;
    await bind(env, token);
    const status = unwrap(await listTabletStatus(env.deps, m));
    expect(status.bound).toBe(1);
    expect(status.tables).toEqual([
      { tableId: t4.tableId, name: "4", version: 1, link: null, boundAt: null, lastSeenAt: null },
      {
        tableId: t12.tableId,
        name: "12",
        version: 2,
        link: `http://localhost:3000/t/${token}`,
        boundAt: env.clock.now().toISOString(),
        lastSeenAt: null,
      },
    ]);

    // Não cresce com o número de mesas.
    const few = countingEnv(env);
    unwrap(await listTabletStatus(few.deps, m));
    const nFew = few.take();
    for (let i = 20; i < 80; i++) await tableWithQr(env, m, String(i));
    const many = countingEnv(env);
    unwrap(await listTabletStatus(many.deps, m));
    expect(many.take()).toBe(nFew);
    await few.close();
    await many.close();
  });

  it("chef e caixa: FORBIDDEN com DENIED", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "12");
    for (const roles of [["CHEF"], ["CASHIER"]] as const) {
      const who = await addMember(env, m, [...roles], roles[0]);
      expect(code(await listTabletStatus(env.deps, who))).toBe("FORBIDDEN");
      expect(code(await createTabletLink(env.deps, who, { tableId: t.tableId, version: 1 }))).toBe("FORBIDDEN");
      expect(code(await releaseTablet(env.deps, who, { tableId: t.tableId }))).toBe("FORBIDDEN");
      expect(code(await rotateTabletLink(env.deps, who, { tableId: t.tableId, version: 1 }))).toBe("FORBIDDEN");
    }
    const denied = await ownerTestDb().execute<{ n: number }>(
      sql`select count(*)::int as n from audit_log where restaurant_id = ${m.restaurantId} and action = 'DENIED'`,
    );
    expect(denied.rows[0]!.n).toBe(8);
  });
});
