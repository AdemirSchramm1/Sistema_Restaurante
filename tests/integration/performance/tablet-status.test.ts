import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";
import { tablet, tableWithQr } from "../ordering/fixtures";
import { tabletStatus } from "../../../src/application/ordering/menu-access";

/**
 * 60 tablets checando ao mesmo tempo (spec 016, R5, SC-007): cada checagem responde rápido no banco
 * do teste e o sinal de vida grava no máximo uma vez por minuto por tablet.
 */
describe("checagem de 60 tablets (spec 016)", () => {
  it("60 checagens em paralelo, menos de 200 ms cada, e no máximo uma gravação por tablet por minuto", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const cookies: string[] = [];
    for (let i = 1; i <= 60; i++) {
      const t = await tableWithQr(env, m, String(i));
      cookies.push(await tablet(env, m, t.tableId));
    }
    const timed = async (c: string) => {
      const start = performance.now();
      const r = await tabletStatus(env.deps, c);
      return { ok: r?.state === "OK", ms: performance.now() - start };
    };
    // Primeira rodada grava o sinal de vida; a segunda, logo em seguida, não grava nada.
    const first = await Promise.all(cookies.map(timed));
    const seen = async () =>
      (
        await ownerTestDb().execute<{ n: number }>(
          sql`select count(*)::int as n from menu_accesses where restaurant_id = ${m.restaurantId} and last_seen_at is not null`,
        )
      ).rows[0]!.n;
    expect(await seen()).toBe(60);
    const stamps = async () =>
      (
        await ownerTestDb().execute<{ s: string }>(
          sql`select string_agg(last_seen_at::text, ',' order by id) as s from menu_accesses where restaurant_id = ${m.restaurantId}`,
        )
      ).rows[0]!.s;
    const before = await stamps();
    env.clock.advance(30_000);
    const second = await Promise.all(cookies.map(timed));
    expect(await stamps()).toBe(before);
    for (const r of [...first, ...second]) expect(r.ok).toBe(true);
    const slow = second.filter((r) => r.ms >= 200);
    expect(slow).toEqual([]);
  });
});
