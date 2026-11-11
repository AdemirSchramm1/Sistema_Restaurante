import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, testDb, testEnv } from "../harness";
import { withTenantTx } from "../../../src/infra/db/db";

/** Spec 011, FR-012: contas, pagamentos e histórico nunca cruzam restaurantes. */

const NOW = "2026-11-11T20:00:00Z";

async function seedTab(restaurantId: string, userId: string, tag: string) {
  const db = ownerTestDb().$client;
  const id = () => crypto.randomUUID();
  const [table, tab, payment] = [id(), id(), id()];
  await db.query(
    `insert into dining_tables (id, restaurant_id, created_at, updated_at, name, name_normalized, qr_token, qr_rotated_at)
     values ($1, $2, $3, $3, '12', '12', $4, $3)`,
    [table, restaurantId, NOW, `tok-${tag}`],
  );
  await db.query(
    `insert into table_tabs (id, restaurant_id, created_at, updated_at, table_id, status, opened_at, service_rate)
     values ($1, $2, $3, $3, $4, 'OPEN', $3, 10)`,
    [tab, restaurantId, NOW, table],
  );
  await db.query(
    `insert into tab_payments (id, restaurant_id, created_at, created_by, tab_id, method, amount, client_request_id)
     values ($1, $2, $3, $4, $5, 'PIX', 40, $1)`,
    [payment, restaurantId, NOW, userId, tab],
  );
  await db.query(
    `insert into tab_payment_removals (id, restaurant_id, created_at, created_by, payment_id) values ($1, $2, $3, $4, $5)`,
    [id(), restaurantId, NOW, userId, payment],
  );
  await db.query(
    `insert into tab_events (id, restaurant_id, created_at, tab_id, kind, at) values ($1, $2, $3, $4, 'OPENED', $3)`,
    [id(), restaurantId, NOW, tab],
  );
  return { table, tab, payment };
}

const TABLES = ["table_tabs", "tab_payments", "tab_payment_removals", "tab_events"];

describe("isolamento das contas entre restaurantes (spec 011, FR-012)", () => {
  it("A não lê nem muda contas, pagamentos e histórico de B, com ou sem filtro da aplicação", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    const seeded = await seedTab(b.restaurantId, b.userId, `tab-${b.restaurantId}`);

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
      const r = await tx.execute(sql`update table_tabs set service_waived = true where id = ${seeded.tab}`);
      return r.rowCount;
    });
    expect(changed).toBe(0);

    const inserts = [
      sql`insert into table_tabs (id, restaurant_id, created_at, updated_at, table_id, status, opened_at)
        values (gen_random_uuid(), ${b.restaurantId}, now(), now(), ${seeded.table}, 'CLOSED', now())`,
      sql`insert into tab_payments (id, restaurant_id, created_at, created_by, tab_id, method, amount, client_request_id)
        values (gen_random_uuid(), ${b.restaurantId}, now(), ${a.userId}, ${seeded.tab}, 'PIX', 1, gen_random_uuid())`,
      sql`insert into tab_events (id, restaurant_id, created_at, tab_id, kind, user_id, at)
        values (gen_random_uuid(), ${b.restaurantId}, now(), ${seeded.tab}, 'CLOSED', ${a.userId}, now())`,
    ];
    for (const q of inserts) {
      const e = await withTenantTx(testDb(), a.restaurantId, (tx) => tx.execute(q)).catch((x: Error) => x);
      expect(String((e as Error).cause)).toMatch(/row-level security/);
    }
  });

  it("a aplicação não apaga nem edita pagamento e histórico; conta não some", async () => {
    const env = testEnv();
    const b = await newRestaurant(env, "Restaurante B");
    await seedTab(b.restaurantId, b.userId, `ro-${b.restaurantId}`);
    for (const stmt of [
      "update tab_payments set amount = 1",
      "delete from tab_payments",
      "delete from tab_payment_removals",
      "update tab_events set reason = 'x'",
      "delete from table_tabs",
    ]) {
      const e = await withTenantTx(testDb(), b.restaurantId, (tx) => tx.execute(sql.raw(stmt))).catch(
        (x: Error) => x,
      );
      expect(String((e as Error).cause), stmt).toMatch(/permission denied|APPEND_ONLY/);
    }
  });
});
