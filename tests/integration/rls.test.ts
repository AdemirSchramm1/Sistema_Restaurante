import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, testDb, testEnv } from "./harness";
import { withTenantTx } from "../../src/infra/db/db";

async function tenantTables(): Promise<string[]> {
  const r = await ownerTestDb().$client.query<{ table_name: string }>(
    `select table_name from information_schema.columns
     where table_schema = 'public' and column_name = 'restaurant_id' order by table_name`,
  );
  return r.rows.map((x) => x.table_name);
}

describe("isolamento entre restaurantes com RLS (ADR 0004, constituição V)", () => {
  it("toda tabela com restaurant_id tem RLS ligado e política", async () => {
    const tables = [...(await tenantTables()), "restaurants"];
    const r = await ownerTestDb().$client.query<{
      relname: string;
      relrowsecurity: boolean;
      policies: string;
    }>(
      `select c.relname, c.relrowsecurity, count(p.polname)::text as policies
       from pg_class c left join pg_policy p on p.polrelid = c.oid
       where c.relname = any($1) group by c.relname, c.relrowsecurity`,
      [tables],
    );
    expect(r.rows).toHaveLength(tables.length);
    for (const row of r.rows) {
      expect(row.relrowsecurity, row.relname).toBe(true);
      expect(Number(row.policies), row.relname).toBeGreaterThan(0);
    }
  });

  it("a aplicação conecta com papel que não ignora o RLS", async () => {
    const r = await testDb().$client.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      "select rolsuper, rolbypassrls from pg_roles where rolname = current_user",
    );
    expect(r.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("restaurante A não lê nem grava linhas de B em nenhuma tabela", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    const tables = await tenantTables();

    for (const t of tables) {
      const own = await ownerTestDb().$client.query(
        `select count(*)::int as n from ${t} where restaurant_id = $1`,
        [b.restaurantId],
      );
      const seenFromA = await withTenantTx(testDb(), a.restaurantId, async (tx) => {
        const r = await tx.execute(
          sql.raw(`select count(*)::int as n from ${t} where restaurant_id = '${b.restaurantId}'`),
        );
        return (r.rows[0] as { n: number }).n;
      });
      expect(seenFromA, t).toBe(0);
      if (t === "item_groups") expect(own.rows[0].n).toBeGreaterThan(0);
    }

    await expect(
      withTenantTx(testDb(), a.restaurantId, (tx) =>
        tx.execute(sql`update item_groups set name = 'invadido' where restaurant_id = ${b.restaurantId}`),
      ).then((r) => r.rowCount),
    ).resolves.toBe(0);

    const insertError = await withTenantTx(testDb(), a.restaurantId, (tx) =>
      tx.execute(sql`insert into item_groups (id, restaurant_id, created_at, updated_at, code, name, storage_class, in_cogs)
        values (gen_random_uuid(), ${b.restaurantId}, now(), now(), '99', 'x', 'FOOD', true)`),
    ).catch((e: Error) => e);
    expect(String((insertError as Error).cause)).toMatch(/row-level security/);
  });

  it("sem restaurante definido, nenhuma linha volta", async () => {
    const env = testEnv();
    await newRestaurant(env);
    const r = await testDb().$client.query("select count(*)::int as n from item_groups");
    expect(r.rows[0].n).toBe(0);
  });
});
