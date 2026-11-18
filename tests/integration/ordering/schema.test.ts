import { describe, it, expect } from "vitest";
import type { PoolClient } from "pg";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";

/** Regras do banco das features 009 e 010 (data-model.md de cada uma). Roda como dono, numa transação desfeita. */
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

async function fails(c: PoolClient, q: string, params: unknown[] = []): Promise<string> {
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

const NOW = "2026-11-08T20:00:00Z";
const ID = (n: number) => `0193a000-0000-7000-8000-${String(n).padStart(12, "0")}`;

async function scenario(c: PoolClient, restaurantId: string) {
  await c.query(
    `insert into dining_tables (id, restaurant_id, created_at, updated_at, name, name_normalized, qr_token, qr_rotated_at)
     values ($1, $2, $3, $3, '12', '12', 'tok-12', $3)`,
    [ID(1), restaurantId, NOW],
  );
  await c.query(
    `insert into menu_accesses (id, restaurant_id, created_at, table_id, token_hash, opened_at, expires_at)
     values ($1, $2, $3, $4, 'h1', $3, $3::timestamptz + interval '20 minutes')`,
    [ID(2), restaurantId, NOW, ID(1)],
  );
  await c.query(
    `insert into recipes (id, restaurant_id, created_at, updated_at, name, name_normalized, kind, sale_price)
     values ($1, $2, $3, $3, 'X-Burger', 'x-burger', 'DISH', 28)`,
    [ID(3), restaurantId, NOW],
  );
  await c.query(
    `insert into recipe_versions (id, restaurant_id, created_at, recipe_id, number, valid_from) values ($1, $2, $3, $4, 1, $3)`,
    [ID(4), restaurantId, NOW, ID(3)],
  );
  await c.query(
    `insert into orders (id, restaurant_id, created_at, table_id, menu_access_id, client_request_id, business_day, number,
       status, total, submitted_at, status_changed_at)
     values ($1, $2, $3, $4, $5, $1, '2026-11-08', 1, 'RECEIVED', 56, $3, $3)`,
    [ID(5), restaurantId, NOW, ID(1), ID(2)],
  );
  await c.query(
    `insert into order_lines (id, restaurant_id, created_at, order_id, position, recipe_id, recipe_version_id, quantity, base_price, unit_price)
     values ($1, $2, $3, $4, 1, $5, $6, 2, 28, 28)`,
    [ID(6), restaurantId, NOW, ID(5), ID(3), ID(4)],
  );
  await c.query(
    `insert into order_status_events (id, restaurant_id, created_at, order_id, to_status, at) values ($1, $2, $3, $4, 'RECEIVED', $3)`,
    [ID(7), restaurantId, NOW, ID(5)],
  );
}

describe("banco dos pedidos (spec 009, data-model.md)", () => {
  it("mesas: nome único entre as ativas; inativa libera o nome", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      const dup = `insert into dining_tables (id, restaurant_id, created_at, updated_at, name, name_normalized, qr_token, qr_rotated_at, active)
        values ($1, $2, $3, $3, '12', '12', $4, $3, $5)`;
      expect(await fails(c, dup, [ID(20), r.restaurantId, NOW, "tok-x", true])).toBe(
        "dining_tables_active_name",
      );
      expect(await fails(c, dup, [ID(21), r.restaurantId, NOW, "tok-y", false])).toBe("OK");
      expect(await fails(c, dup, [ID(22), r.restaurantId, NOW, "tok-12", false])).toBe(
        "dining_tables_qr_token_unique",
      );
    });
  });

  it("acesso fecha exatamente 20 minutos depois da leitura", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      const q = `insert into menu_accesses (id, restaurant_id, created_at, table_id, token_hash, opened_at, expires_at)
        values ($1, $2, $3, $4, $5, $3, $3::timestamptz + interval '30 minutes')`;
      expect(await fails(c, q, [ID(30), r.restaurantId, NOW, ID(1), "h2"])).toBe(
        "menu_accesses_expiry_by_kind",
      );
    });
  });

  it("linhas e eventos do pedido são só inserção; pedido só muda a situação e não é apagado", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      expect(await fails(c, "update order_lines set quantity = 3")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "delete from order_lines")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "update order_status_events set to_status = 'READY'")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "update orders set total = 1")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "delete from orders")).toMatch(/APPEND_ONLY/);
      expect(
        await fails(c, "update orders set status = 'PREPARING', version = 2, status_changed_at = now()"),
      ).toBe("OK");
    });
  });

  it("cancelado exige motivo; 'Outro' exige texto de até 140", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      expect(await fails(c, "update orders set status = 'CANCELLED'")).toBe("orders_cancel_reason");
      expect(await fails(c, "update orders set status = 'CANCELLED', cancel_reason = 'OTHER'")).toBe(
        "orders_cancel_note",
      );
      expect(
        await fails(c, "update orders set status = 'CANCELLED', cancel_reason = 'OTHER', cancel_note = $1", [
          "x".repeat(141),
        ]),
      ).toBe("orders_cancel_note_length");
      expect(
        await fails(c, "update orders set status = 'CANCELLED', cancel_reason = 'CUSTOMER_GAVE_UP'"),
      ).toBe("OK");
    });
  });

  it("linha: quantidade de 1 a 20 e preço da linha ≥ preço do produto", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      const q = `insert into order_lines (id, restaurant_id, created_at, order_id, position, recipe_id, recipe_version_id, quantity, base_price, unit_price)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
      const base = [r.restaurantId, NOW, ID(5)];
      expect(await fails(c, q, [ID(40), ...base, 2, ID(3), ID(4), 21, 28, 28])).toBe("order_lines_quantity");
      expect(await fails(c, q, [ID(41), ...base, 3, ID(3), ID(4), 1, 28, 27])).toBe("order_lines_unit_price");
      expect(await fails(c, q, [ID(42), ...base, 4, ID(3), ID(4), 1, 28, 34])).toBe("OK");
    });
  });

  it("número do pedido é único por restaurante e dia", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      const q = `insert into orders (id, restaurant_id, created_at, table_id, menu_access_id, client_request_id, business_day, number,
        status, total, submitted_at, status_changed_at) values ($1, $2, $3, $4, $5, $1, $6, 1, 'RECEIVED', 9, $3, $3)`;
      expect(await fails(c, q, [ID(50), r.restaurantId, NOW, ID(1), ID(2), "2026-11-08"])).toBe(
        "orders_day_number",
      );
      expect(await fails(c, q, [ID(51), r.restaurantId, NOW, ID(1), ID(2), "2026-11-09"])).toBe("OK");
    });
  });

  it("esgotado só em produto vendido; restaurante começa recebendo pedidos", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      const q = `insert into recipes (id, restaurant_id, created_at, updated_at, name, name_normalized, kind, sold_out_on)
        values ($1, $2, $3, $3, 'Molho', 'molho', 'SUB_RECIPE', '2026-11-08')`;
      expect(await fails(c, q, [ID(60), r.restaurantId, NOW])).toBe("recipes_sold_out_dish");
      const on = await c.query("select accepting_qr_orders from restaurants where id = $1", [r.restaurantId]);
      expect(on.rows[0].accepting_qr_orders).toBe(true);
    });
  });

  it("papel Garçom existe no banco", async () => {
    const r = await ownerTestDb().$client.query("select enum_range(null::role)::text as v");
    expect(r.rows[0].v).toContain("WAITER");
  });
});

describe("banco dos adicionais (spec 010, data-model.md)", () => {
  async function unitId(c: PoolClient, code: string) {
    return (await c.query("select id from units where code = $1", [code])).rows[0].id as string;
  }

  it("adicional: item ou preparo, preço ≥ 0, nome único entre ativos", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      const g = await unitId(c, "g");
      const q = `insert into addons (id, restaurant_id, created_at, updated_at, name, name_normalized, item_id, sub_recipe_id, quantity, unit_id, price)
        values ($1, $2, $3, $3, $4, $5, null, $6, 20, $7, $8)`;
      expect(await fails(c, q, [ID(70), r.restaurantId, NOW, "Grátis", "gratis", ID(3), g, 0])).toBe("OK");
      expect(await fails(c, q, [ID(71), r.restaurantId, NOW, "Grátis", "gratis", ID(3), g, 1])).toBe(
        "addons_active_name",
      );
      expect(await fails(c, q, [ID(72), r.restaurantId, NOW, "Neg", "neg", ID(3), g, -1])).toBe(
        "addons_price",
      );
      expect(await fails(c, q, [ID(73), r.restaurantId, NOW, "Sem", "sem", null, g, 1])).toBe(
        "addons_one_component",
      );
    });
  });

  it("máximo de vezes de 1 a 5; escolhas do pedido são só inserção", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      const g = await unitId(c, "g");
      await c.query(
        `insert into addons (id, restaurant_id, created_at, updated_at, name, name_normalized, sub_recipe_id, quantity, unit_id, price)
         values ($1, $2, $3, $3, 'Queijo', 'queijo', $4, 20, $5, 3)`,
        [ID(80), r.restaurantId, NOW, ID(3), g],
      );
      const link = `insert into recipe_addons (id, restaurant_id, created_at, recipe_id, addon_id, max_times, position) values ($1, $2, $3, $4, $5, $6, 1)`;
      expect(await fails(c, link, [ID(81), r.restaurantId, NOW, ID(3), ID(80), 6])).toBe(
        "recipe_addons_max_times",
      );
      expect(await fails(c, link, [ID(82), r.restaurantId, NOW, ID(3), ID(80), 3])).toBe("OK");
      await c.query(
        `insert into order_line_addons (id, restaurant_id, created_at, order_line_id, addon_id, name, times, unit_price, sub_recipe_id, quantity, unit_id)
         values ($1, $2, $3, $4, $5, 'Queijo', 2, 3, $6, 20, $7)`,
        [ID(83), r.restaurantId, NOW, ID(6), ID(80), ID(3), g],
      );
      await c.query(
        `insert into order_line_removals (id, restaurant_id, created_at, order_line_id, sub_recipe_id, label) values ($1, $2, $3, $4, $5, 'Sem molho')`,
        [ID(84), r.restaurantId, NOW, ID(6), ID(3)],
      );
      expect(await fails(c, "update order_line_addons set times = 1")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "delete from order_line_removals")).toMatch(/APPEND_ONLY/);
    });
  });
});
