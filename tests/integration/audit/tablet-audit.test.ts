import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";
import { tablet, tableWithQr, unwrap } from "../ordering/fixtures";
import { releaseTablet, rotateTabletLink } from "../../../src/application/ordering/tablets";

/** O código do link do tablet nunca vai para a trilha de auditoria (spec 016, FR-010, R14). */
const tokenOf = async (tableId: string) =>
  (
    await ownerTestDb().execute<{ tablet_token: string; version: number }>(
      sql`select tablet_token, version from dining_tables where id = ${tableId}`,
    )
  ).rows[0]!;

describe("auditoria do tablet sem o token (spec 016)", () => {
  it("criar link, ligar, liberar e trocar link: nenhuma linha contém o token antigo nem o novo", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "12");
    const cookie = await tablet(env, m, t.tableId);
    const old = await tokenOf(t.tableId);
    unwrap(await releaseTablet(env.deps, m, { tableId: t.tableId }));
    unwrap(await rotateTabletLink(env.deps, m, { tableId: t.tableId, version: old.version }));
    const fresh = await tokenOf(t.tableId);
    const rows = await ownerTestDb().execute<{ text: string }>(
      sql`select coalesce(changes::text, '') || ' ' || coalesce(origin::text, '') as text
          from audit_log where restaurant_id = ${m.restaurantId}`,
    );
    expect(rows.rows.length).toBeGreaterThanOrEqual(4);
    for (const secret of [old.tablet_token, fresh.tablet_token, cookie])
      expect(rows.rows.filter((r) => r.text.includes(secret))).toEqual([]);
  });
});
