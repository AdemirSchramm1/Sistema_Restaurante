import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, testDb, testEnv } from "../harness";
import { withTenantTx } from "../../../src/infra/db/db";
import { cryptoTokens } from "../../../src/infra/tokens";

/** Spec 009: o restaurante e a mesa vêm só do token; A nunca vê nem grava nada de B. */

const NOW = "2026-11-08T20:00:00Z";

async function seedOrders(restaurantId: string, tag: string) {
  const db = ownerTestDb().$client;
  const id = () => crypto.randomUUID();
  const table = id();
  const access = id();
  const recipe = id();
  const version = id();
  const order = id();
  const hash = cryptoTokens.hash(`acesso-${tag}`);
  await db.query(
    `insert into dining_tables (id, restaurant_id, created_at, updated_at, name, name_normalized, qr_token, qr_rotated_at)
     values ($1, $2, $3, $3, '7', '7', $4, $3)`,
    [table, restaurantId, NOW, `tok-${tag}`],
  );
  await db.query(
    `insert into menu_accesses (id, restaurant_id, created_at, table_id, token_hash, opened_at, expires_at)
     values ($1, $2, $3, $4, $5, $3, $3::timestamptz + interval '20 minutes')`,
    [access, restaurantId, NOW, table, hash],
  );
  await db.query(
    `insert into recipes (id, restaurant_id, created_at, updated_at, name, name_normalized, kind, sale_price)
     values ($1, $2, $3, $3, 'Suco', 'suco', 'DISH', 9)`,
    [recipe, restaurantId, NOW],
  );
  await db.query(
    `insert into recipe_versions (id, restaurant_id, created_at, recipe_id, number, valid_from) values ($1, $2, $3, $4, 1, $3)`,
    [version, restaurantId, NOW, recipe],
  );
  await db.query(
    `insert into orders (id, restaurant_id, created_at, table_id, menu_access_id, client_request_id, business_day, number,
       status, total, submitted_at, status_changed_at)
     values ($1, $2, $3, $4, $5, $1, '2026-11-08', 1, 'RECEIVED', 9, $3, $3)`,
    [order, restaurantId, NOW, table, access],
  );
  await db.query(
    `insert into order_lines (id, restaurant_id, created_at, order_id, position, recipe_id, recipe_version_id, quantity, base_price, unit_price)
     values ($1, $2, $3, $4, 0, $5, $6, 1, 9, 9)`,
    [id(), restaurantId, NOW, order, recipe, version],
  );
  await db.query(
    `insert into order_status_events (id, restaurant_id, created_at, order_id, from_status, to_status, at)
     values ($1, $2, $3, $4, null, 'RECEIVED', $3)`,
    [id(), restaurantId, NOW, order],
  );
  await db.query(
    `insert into order_day_counters (restaurant_id, business_day, last_number) values ($1, '2026-11-08', 1)`,
    [restaurantId],
  );
  return { table, access, order, hash, token: `tok-${tag}` };
}

const TABLES = [
  "dining_tables",
  "menu_accesses",
  "orders",
  "order_lines",
  "order_status_events",
  "order_day_counters",
];

describe("isolamento dos pedidos entre restaurantes (spec 009)", () => {
  it("A não lê nem muda mesas, acessos e pedidos de B, com ou sem filtro da aplicação", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    const seeded = await seedOrders(b.restaurantId, `iso-${b.restaurantId}`);

    for (const t of TABLES) {
      const [all, filtered] = await withTenantTx(testDb(), a.restaurantId, async (tx) => {
        const x = await tx.execute(sql.raw(`select count(*)::int as n from ${t}`));
        const y = await tx.execute(
          sql.raw(`select count(*)::int as n from ${t} where restaurant_id = '${b.restaurantId}'`),
        );
        return [(x.rows[0] as { n: number }).n, (y.rows[0] as { n: number }).n];
      });
      expect(all, t).toBe(0);
      expect(filtered, t).toBe(0);
    }

    const changed = await withTenantTx(testDb(), a.restaurantId, async (tx) => {
      const r1 = await tx.execute(sql`update dining_tables set active = false where id = ${seeded.table}`);
      const r2 = await tx.execute(sql`update orders set status = 'PREPARING' where id = ${seeded.order}`);
      const r3 = await tx.execute(sql`update menu_accesses set ended_at = now() where id = ${seeded.access}`);
      return [r1.rowCount, r2.rowCount, r3.rowCount];
    });
    expect(changed).toEqual([0, 0, 0]);

    const insertError = await withTenantTx(testDb(), a.restaurantId, (tx) =>
      tx.execute(sql`insert into dining_tables (id, restaurant_id, created_at, updated_at, name, name_normalized, qr_token, qr_rotated_at)
        values (gen_random_uuid(), ${b.restaurantId}, now(), now(), 'x', 'x', ${`invasor-${b.restaurantId}`}, now())`),
    ).catch((e: Error) => e);
    expect(String((insertError as Error).cause)).toMatch(/row-level security/);
  });

  it("as funções do QR code devolvem só o mínimo e o token de B leva só a B", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    const seeded = await seedOrders(b.restaurantId, `fn-${b.restaurantId}`);

    const byToken = await testDb().$client.query("select * from app_table_by_qr_token($1)", [seeded.token]);
    expect(byToken.fields.map((f) => f.name)).toEqual(["restaurant_id", "table_id", "active"]);
    expect(byToken.rows).toEqual([{ restaurant_id: b.restaurantId, table_id: seeded.table, active: true }]);

    const byHash = await testDb().$client.query("select * from app_menu_access_by_token_hash($1)", [
      seeded.hash,
    ]);
    expect(byHash.fields.map((f) => f.name)).toEqual(["restaurant_id", "menu_access_id"]);

    await expect(env.deps.global.tableByQrToken(seeded.token)).resolves.toEqual({
      restaurantId: b.restaurantId,
      tableId: seeded.table,
      active: true,
    });
    await expect(env.deps.global.tableByQrToken("nao-existe")).resolves.toBeNull();
    await expect(env.deps.global.menuAccessByTokenHash(seeded.hash)).resolves.toEqual({
      restaurantId: b.restaurantId,
      menuAccessId: seeded.access,
    });
    await expect(env.deps.global.menuAccessByTokenHash("nao-existe")).resolves.toBeNull();

    // Mesmo sabendo o id da mesa de B, no restaurante A ela não existe.
    const inA = await env.deps.tenant(a.restaurantId, async (repos) => ({
      ok: true as const,
      value: [await repos.tables.get(seeded.table), await repos.menuAccesses.get(seeded.access)],
    }));
    expect(inA).toEqual({ ok: true, value: [null, null] });
  });
});
