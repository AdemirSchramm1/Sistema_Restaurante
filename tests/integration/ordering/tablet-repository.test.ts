import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, testEnv, type TestEnv } from "../harness";
import { code, orderingScenario, scan, tableWithQr, unwrap } from "./fixtures";
import type { Repos } from "../../../src/application/ports";
import type { RequestContext } from "../../../src/application/context";
import { ok } from "../../../src/domain/shared/result";

/** Spec 016, T014: repositórios do tablet da mesa contra o PostgreSQL de verdade. */

const inRepos = async <T>(env: TestEnv, ctx: RequestContext, fn: (repos: Repos) => Promise<T>): Promise<T> =>
  unwrap(await env.deps.tenant(ctx.restaurantId, async (repos) => ok(await fn(repos))));

const tablet = (env: TestEnv, tableId: string, hash: string) => ({
  id: env.deps.ids.next(),
  tableId,
  tokenHash: hash,
  openedAt: env.clock.now(),
  ip: "203.0.113.9",
  userAgent: "Tablet de teste",
});

const lastSeen = async (id: string) =>
  new Date(
    (
      await ownerTestDb().execute<{ at: string }>(
        sql`select last_seen_at::text as at from menu_accesses where id = ${id}`,
      )
    ).rows[0]!.at,
  );

describe("repositórios do tablet da mesa (spec 016, data-model.md)", () => {
  it("link do tablet: grava o token, soma 1 na versão e recusa versão velha", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "12");
    const audit = { at: env.clock.now(), by: m.userId };
    await inRepos(env, m, async (repos) => {
      const before = (await repos.tables.get(t.tableId))!;
      expect(before.tabletToken).toBeNull();
      expect(code(await repos.tables.setTabletToken(t.tableId, "tab-1", before.version, audit))).toBe("OK");
      const after = (await repos.tables.get(t.tableId))!;
      expect(after).toMatchObject({ tabletToken: "tab-1", version: before.version + 1 });
      expect(code(await repos.tables.setTabletToken(t.tableId, "tab-2", before.version, audit))).toBe(
        "STALE_RECORD",
      );
    });
  });

  it("um tablet aberto por mesa: o segundo perde; depois de encerrar, liga de novo", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t12 = await tableWithQr(env, m, "12");
    const t4 = await tableWithQr(env, m, "4");
    await inRepos(env, m, async (repos) => {
      expect(await repos.menuAccesses.openTablet(t12.tableId)).toBeNull();
      const first = tablet(env, t12.tableId, "h1");
      expect(await repos.menuAccesses.insertTablet(first)).toBe(true);
      expect(await repos.menuAccesses.insertTablet(tablet(env, t12.tableId, "h2"))).toBe(false);
      expect(await repos.menuAccesses.insertTablet(tablet(env, t4.tableId, "h3"))).toBe(true);
      expect(await repos.menuAccesses.openTablet(t12.tableId)).toMatchObject({
        id: first.id,
        kind: "TABLET",
        expiresAt: null,
        endedAt: null,
        lastSeenAt: null,
      });
      await repos.menuAccesses.end(first.id, env.clock.now(), "RELEASED");
      expect(await repos.menuAccesses.openTablet(t12.tableId)).toBeNull();
      expect(await repos.menuAccesses.insertTablet(tablet(env, t12.tableId, "h4"))).toBe(true);
    });
  });

  it("sinal de vida: grava no máximo uma vez por minuto", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "12");
    const a = tablet(env, t.tableId, "h1");
    await inRepos(env, m, (repos) => repos.menuAccesses.insertTablet(a));
    const touch = () => inRepos(env, m, (repos) => repos.menuAccesses.touch(a.id, env.clock.now()));
    expect(await touch()).toBe(true);
    const first = env.clock.now();
    env.clock.advance(30_000);
    expect(await touch()).toBe(false);
    expect(await lastSeen(a.id)).toEqual(first);
    env.clock.advance(31_000);
    expect(await touch()).toBe(true);
    expect(await lastSeen(a.id)).toEqual(env.clock.now());
  });

  it("fechar a conta encerra só os acessos do QR code (R6)", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "12");
    await scan(env, t.token);
    const a = tablet(env, t.tableId, "h1");
    await inRepos(env, m, async (repos) => {
      await repos.menuAccesses.insertTablet(a);
      expect(await repos.menuAccesses.endOpenForTable(t.tableId, env.clock.now(), "TAB_CLOSED")).toBe(1);
      expect((await repos.menuAccesses.openTablet(t.tableId))?.id).toBe(a.id);
    });
  });

  it("situação dos tablets: mesas ativas com link, ligado desde e visto há, numa consulta", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t12 = await tableWithQr(env, m, "12");
    const t4 = await tableWithQr(env, m, "4");
    const audit = { at: env.clock.now(), by: m.userId };
    const a = tablet(env, t12.tableId, "h1");
    await inRepos(env, m, async (repos) => {
      await repos.tables.setTabletToken(t12.tableId, "tab-12", 1, audit);
      await repos.menuAccesses.insertTablet(a);
      await repos.menuAccesses.touch(a.id, env.clock.now());
      expect(await repos.tables.tabletStatus()).toEqual([
        { tableId: t4.tableId, name: "4", tabletToken: null, version: 1, boundAt: null, lastSeenAt: null },
        {
          tableId: t12.tableId,
          name: "12",
          tabletToken: "tab-12",
          version: 2,
          boundAt: env.clock.now(),
          lastSeenAt: env.clock.now(),
        },
      ]);
    });
  });

  it("carimbo do tablet: muda com nome da mesa, pedido, situação do pedido e aparência", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const stamp = () => inRepos(env, m, (repos) => repos.orders.tabletStamp(s.table.tableId));
    const empty = await stamp();
    expect(empty.tabId).toBeNull();
    expect(await stamp()).toEqual(empty);

    const order = await s.place([s.juice()]);
    const withOrder = await stamp();
    expect(withOrder.tabId).not.toBeNull();
    expect(withOrder.stamp).not.toBe(empty.stamp);

    env.clock.advance(1000);
    await ownerTestDb().execute(
      sql`update orders set status = 'PREPARING', status_changed_at = ${env.clock.now()} where id = ${order.orderId}`,
    );
    const preparing = await stamp();
    expect(preparing.stamp).not.toBe(withOrder.stamp);

    await ownerTestDb().execute(
      sql`update dining_tables set version = version + 1 where id = ${s.table.tableId}`,
    );
    const renamed = await stamp();
    expect(renamed.stamp).not.toBe(preparing.stamp);

    await ownerTestDb().execute(
      sql`update restaurants set version = version + 1 where id = ${m.restaurantId}`,
    );
    expect((await stamp()).stamp).not.toBe(renamed.stamp);
  });

  it("rota pública: mesa pelo link do tablet e o tipo do acesso pelo hash", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "12");
    const audit = { at: env.clock.now(), by: m.userId };
    await inRepos(env, m, async (repos) => {
      await repos.tables.setTabletToken(t.tableId, "tab-xyz", 1, audit);
      await repos.menuAccesses.insertTablet(tablet(env, t.tableId, "hash-tablet"));
    });
    expect(await env.deps.global.tableByTabletToken("tab-xyz")).toEqual({
      restaurantId: m.restaurantId,
      tableId: t.tableId,
      active: true,
    });
    expect(await env.deps.global.tableByTabletToken("")).toBeNull();
    expect(await env.deps.global.menuAccessByTokenHash("hash-tablet")).toMatchObject({
      restaurantId: m.restaurantId,
      kind: "TABLET",
    });
  });
});
