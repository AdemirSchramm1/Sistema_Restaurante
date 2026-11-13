import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { newRestaurant, ownerTestDb, testDb, testEnv } from "../harness";
import { sql } from "drizzle-orm";
import { withTenantTx } from "../../../src/infra/db/db";

/** Regras do banco da feature 013 (specs/013-editar-cardapio/data-model.md). Como dono, em transação desfeita. */
async function inTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await ownerTestDb().$client.connect();
  try {
    await c.query("begin");
    return await fn(c);
  } finally {
    await c.query("rollback");
    c.release();
  }
}

async function attempt(c: PoolClient, q: string, params: unknown[] = []): Promise<string> {
  await c.query("savepoint s");
  try {
    await c.query(q, params);
    await c.query("release savepoint s");
    return "OK";
  } catch (e) {
    await c.query("rollback to savepoint s");
    const pg = e as { constraint?: string; message: string };
    return pg.constraint ?? pg.message;
  }
}

const NOW = "2026-11-13T12:00:00Z";
const ID = (n: number) => `0193b000-0000-7000-8000-${String(n).padStart(12, "0")}`;

const section = (c: PoolClient, id: string, restaurantId: string, name: string, position: number) =>
  attempt(
    c,
    `insert into menu_sections (id, restaurant_id, created_at, updated_at, name, name_normalized, position)
     values ($1, $2, $3, $3, $4, lower($4), $5)`,
    [id, restaurantId, NOW, name, position],
  );

const recipe = (c: PoolClient, id: string, restaurantId: string, name: string, kind = "DISH") =>
  c.query(
    `insert into recipes (id, restaurant_id, created_at, updated_at, name, name_normalized, kind)
     values ($1, $2, $3, $3, $4, lower($4), $5)`,
    [id, restaurantId, NOW, name, kind],
  );

describe("banco da edição do cardápio (spec 013, data-model.md)", () => {
  it("seção: nome de 1 a 40 caracteres, único no restaurante, posição maior que zero", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    await inTx(async (c) => {
      expect(await section(c, ID(1), a.restaurantId, "Lanches", 1)).toBe("OK");
      expect(await section(c, ID(2), a.restaurantId, "LANCHES", 2)).toBe("menu_sections_name");
      expect(await section(c, ID(3), b.restaurantId, "Lanches", 1)).toBe("OK");
      expect(await section(c, ID(4), a.restaurantId, "", 2)).toBe("menu_sections_name_length");
      expect(await section(c, ID(5), a.restaurantId, "a".repeat(41), 2)).toBe("menu_sections_name_length");
      expect(await section(c, ID(6), a.restaurantId, "a".repeat(40), 2)).toBe("OK");
      expect(await section(c, ID(7), a.restaurantId, "Bebidas", 0)).toBe("menu_sections_position_positive");
    });
  });

  it("seção: duas não ficam na mesma posição, mas trocar vizinhas cabe numa transação", async () => {
    const env = testEnv();
    const a = await newRestaurant(env);
    const c = await ownerTestDb().$client.connect();
    try {
      await c.query("begin");
      await section(c, ID(1), a.restaurantId, "Entradas", 1);
      await section(c, ID(2), a.restaurantId, "Lanches", 2);
      await c.query("commit");

      await c.query("begin");
      await c.query("update menu_sections set position = 2 where id = $1", [ID(1)]);
      await c.query("update menu_sections set position = 1 where id = $1", [ID(2)]);
      await c.query("commit");
      const rows = await c.query("select name from menu_sections order by position");
      expect(rows.rows.map((r) => r.name)).toEqual(["Lanches", "Entradas"]);

      await c.query("begin");
      await c.query("update menu_sections set position = 1 where id = $1", [ID(1)]);
      const error = await c.query("commit").then(
        () => "OK",
        (e: { constraint?: string }) => e.constraint,
      );
      expect(error).toBe("menu_sections_position");
    } finally {
      await c.query("rollback").catch(() => undefined);
      c.release();
    }
  });

  it("produto: descrição até 300, foto com base e larguras juntas, seção só do mesmo restaurante", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    await inTx(async (c) => {
      await recipe(c, ID(10), a.restaurantId, "X-Burger");
      await section(c, ID(1), a.restaurantId, "Lanches", 1);
      await section(c, ID(2), b.restaurantId, "Lanches", 1);
      const set = (column: string, value: unknown) =>
        attempt(c, `update recipes set ${column} = $2 where id = $1`, [ID(10), value]);

      expect(await set("description", "a".repeat(300))).toBe("OK");
      expect(await set("description", "a".repeat(301))).toBe("recipes_description_length");
      expect(await set("description", "")).toBe("recipes_description_length");
      expect(await set("menu_section_id", ID(1))).toBe("OK");
      expect(await set("menu_section_id", ID(2))).toBe("recipes_menu_section_fk");
      expect(await set("photo_base", "/fotos/menu/abc")).toBe("recipes_photo_pair");
      expect(await set("photo_widths", "{300,600}")).toBe("recipes_photo_pair");
      expect(
        await attempt(
          c,
          `update recipes set photo_base = '/fotos/menu/abc', photo_widths = '{}' where id = $1`,
          [ID(10)],
        ),
      ).toBe("recipes_photo_pair");
      expect(
        await attempt(
          c,
          `update recipes set photo_base = '/fotos/menu/abc', photo_widths = '{300,600}' where id = $1`,
          [ID(10)],
        ),
      ).toBe("OK");
    });
  });

  it("preparo não tem descrição, seção, foto nem posição no cardápio", async () => {
    const env = testEnv();
    const a = await newRestaurant(env);
    await inTx(async (c) => {
      await recipe(c, ID(11), a.restaurantId, "Molho", "SUB_RECIPE");
      await section(c, ID(1), a.restaurantId, "Lanches", 1);
      const set = (assign: string) => attempt(c, `update recipes set ${assign} where id = $1`, [ID(11)]);
      expect(await set("description = 'Molho da casa'")).toBe("recipes_menu_only_dish");
      expect(await set(`menu_section_id = '${ID(1)}'`)).toBe("recipes_menu_only_dish");
      expect(await set("menu_position = 1")).toBe("recipes_menu_only_dish");
      expect(await set("photo_base = '/x', photo_widths = '{300}'")).toBe("recipes_menu_only_dish");
      expect(await set("menu_position = 0")).toBe("OK");
    });
  });

  it("a aplicação só lê e grava seções do próprio restaurante (RLS)", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    await ownerTestDb().$client.query(
      `insert into menu_sections (id, restaurant_id, created_at, updated_at, name, name_normalized, position)
       values ($1, $2, $3, $3, 'Lanches', 'lanches', 1)`,
      [ID(1), a.restaurantId, NOW],
    );
    const seen = (restaurantId: string) =>
      withTenantTx(testDb(), restaurantId, async (tx) => {
        const rows = await tx.execute(sql`select name from menu_sections`);
        return rows.rows.length;
      });
    expect(await seen(a.restaurantId)).toBe(1);
    expect(await seen(b.restaurantId)).toBe(0);

    const insertAsB = withTenantTx(testDb(), b.restaurantId, (tx) =>
      tx.execute(
        sql`insert into menu_sections (id, restaurant_id, created_at, updated_at, name, name_normalized, position)
            values (${ID(2)}, ${a.restaurantId}, ${NOW}, ${NOW}, 'Invasão', 'invasao', 2)`,
      ),
    );
    await expect(insertAsB).rejects.toThrow(/row-level security/);

    // A aplicação pode apagar seção (a regra de mandar os produtos para "Outros" é do caso de uso).
    await withTenantTx(testDb(), a.restaurantId, (tx) =>
      tx.execute(sql`delete from menu_sections where id = ${ID(1)}`),
    );
    expect(await seen(a.restaurantId)).toBe(0);
  });

  it("a migração deixa os produtos vendidos em Outros, na ordem alfabética de hoje", async () => {
    const env = testEnv();
    const a = await newRestaurant(env);
    const c = await ownerTestDb().$client.connect();
    try {
      await c.query("begin");
      await recipe(c, ID(20), a.restaurantId, "Suco");
      await recipe(c, ID(21), a.restaurantId, "Água");
      await recipe(c, ID(22), a.restaurantId, "X-Burger");
      await recipe(c, ID(23), a.restaurantId, "Molho", "SUB_RECIPE");
      await c.query("update recipes set name_normalized = 'agua' where id = $1", [ID(21)]);
      // O mesmo comando da migração 0013, que precisa poder rodar de novo sem estragar nada.
      const { MENU_POSITION_BACKFILL } = await import("../../../src/infra/db/menu-backfill");
      await c.query(MENU_POSITION_BACKFILL);
      const rows = await c.query(
        "select name, menu_position, menu_section_id from recipes where restaurant_id = $1 order by name_normalized",
        [a.restaurantId],
      );
      expect(rows.rows).toEqual([
        { name: "Água", menu_position: 1, menu_section_id: null },
        { name: "Molho", menu_position: 0, menu_section_id: null },
        { name: "Suco", menu_position: 2, menu_section_id: null },
        { name: "X-Burger", menu_position: 3, menu_section_id: null },
      ]);
    } finally {
      await c.query("rollback");
      c.release();
    }
  });
});
