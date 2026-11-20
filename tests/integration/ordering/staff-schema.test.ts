import { describe, it, expect } from "vitest";
import type { PoolClient } from "pg";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";

/**
 * Regras do banco da feature 015 (specs/015-pedido-pelo-garcom/data-model.md): origem do pedido,
 * quem lançou, envio sem duplicar, observação para a cozinha e o motivo "Lançado errado". Roda
 * como dono, numa transação desfeita.
 */
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

const NOW = "2026-11-17T20:00:00Z";
const ID = (n: number) => `0193a015-0000-7000-8000-${String(n).padStart(12, "0")}`;

/** Mesa 12 com um acesso pelo QR code, X-Burger e um pedido 1 pelo QR code. */
async function scenario(c: PoolClient, restaurantId: string) {
  await c.query(
    `insert into dining_tables (id, restaurant_id, created_at, updated_at, name, name_normalized, qr_token, qr_rotated_at)
     values ($1, $2, $3, $3, '12', '12', $4, $3)`,
    [ID(1), restaurantId, NOW, `tok-${restaurantId}`],
  );
  await c.query(
    `insert into menu_accesses (id, restaurant_id, created_at, table_id, token_hash, opened_at, expires_at)
     values ($1, $2, $3, $4, $5, $3, $3::timestamptz + interval '20 minutes')`,
    [ID(2), restaurantId, NOW, ID(1), `h-${restaurantId}`],
  );
  await c.query(
    `insert into recipes (id, restaurant_id, created_at, updated_at, name, name_normalized, kind, sale_price)
     values ($1, $2, $3, $3, 'X-Burger', 'x-burger', 'DISH', 30)`,
    [ID(3), restaurantId, NOW],
  );
  await c.query(
    `insert into recipe_versions (id, restaurant_id, created_at, recipe_id, number, valid_from) values ($1, $2, $3, $4, 1, $3)`,
    [ID(4), restaurantId, NOW, ID(3)],
  );
  await c.query(
    `insert into orders (id, restaurant_id, created_at, table_id, menu_access_id, client_request_id, business_day, number,
       status, total, submitted_at, status_changed_at)
     values ($1, $2, $3, $4, $5, $1, '2026-11-17', 1, 'RECEIVED', 30, $3, $3)`,
    [ID(5), restaurantId, NOW, ID(1), ID(2)],
  );
}

/** Pedido da equipe (`source`, `placed_by`, `menu_access_id` à escolha do teste). */
const staffOrder = `insert into orders (id, restaurant_id, created_at, created_by, table_id, menu_access_id, client_request_id,
    business_day, number, status, total, submitted_at, status_changed_at, source, placed_by)
  values ($1, $2, $3, $6, $4, $5, $7, '2026-11-17', $8, 'RECEIVED', 30, $3, $3, $9, $6)`;

const line = `insert into order_lines (id, restaurant_id, created_at, order_id, position, recipe_id, recipe_version_id,
    quantity, base_price, unit_price, kitchen_note)
  values ($1, $2, $3, $4, 1, $5, $6, 1, 30, 30, $7)`;

describe("banco do pedido da equipe (spec 015, data-model.md)", () => {
  it("pedidos que já existiam viram QR code, sem quem lançou", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      const { rows } = await c.query("select source, placed_by from orders where id = $1", [ID(5)]);
      expect(rows).toEqual([{ source: "QR", placed_by: null }]);
    });
  });

  it("orders_source_shape: equipe sempre com quem lançou e sem acesso; QR code o contrário", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      const args = (n: number, access: string | null, placedBy: string | null, source: string) => [
        ID(10 + n),
        r.restaurantId,
        NOW,
        ID(1),
        access,
        placedBy,
        ID(30 + n),
        10 + n,
        source,
      ];
      expect(await fails(c, staffOrder, args(1, null, r.userId, "STAFF"))).toBe("OK");
      expect(await fails(c, staffOrder, args(2, null, null, "STAFF"))).toBe("orders_source_shape");
      expect(await fails(c, staffOrder, args(3, ID(2), r.userId, "STAFF"))).toBe("orders_source_shape");
      expect(await fails(c, staffOrder, args(4, null, null, "QR"))).toBe("orders_source_shape");
      expect(await fails(c, staffOrder, args(5, ID(2), r.userId, "QR"))).toBe("orders_source_shape");
    });
  });

  it("o mesmo envio da mesma pessoa não grava dois pedidos (orders_staff_client_request)", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      const args = (id: number, number: number) => [
        ID(id),
        r.restaurantId,
        NOW,
        ID(1),
        null,
        r.userId,
        ID(99),
        number,
        "STAFF",
      ];
      expect(await fails(c, staffOrder, args(11, 11))).toBe("OK");
      expect(await fails(c, staffOrder, args(12, 12))).toBe("orders_staff_client_request");
    });
  });

  it("origem, quem lançou e acesso nunca mudam depois do envio", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      await c.query(staffOrder, [ID(11), r.restaurantId, NOW, ID(1), null, r.userId, ID(31), 11, "STAFF"]);
      expect(
        await fails(
          c,
          "update orders set source = 'STAFF', placed_by = $1, menu_access_id = null where id = $2",
          [r.userId, ID(5)],
        ),
      ).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "update orders set placed_by = null where id = $1", [ID(11)])).toMatch(
        /APPEND_ONLY|orders_source_shape/,
      );
      expect(await fails(c, "update orders set menu_access_id = $1 where id = $2", [ID(2), ID(11)])).toMatch(
        /APPEND_ONLY|orders_source_shape/,
      );
      expect(
        await fails(
          c,
          "update orders set status = 'PREPARING', version = 2, status_changed_at = now() where id = $1",
          [ID(11)],
        ),
      ).toBe("OK");
    });
  });

  it("observação para a cozinha: de 1 a 140 letras ou nenhuma; a linha continua só inserção", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      const args = (n: number, note: string | null) => [
        ID(40 + n),
        r.restaurantId,
        NOW,
        ID(5),
        ID(3),
        ID(4),
        note,
      ];
      expect(await fails(c, line, args(1, "mal passado"))).toBe("OK");
      expect(await fails(c, line.replace("1, $5", "2, $5"), args(2, null))).toBe("OK");
      expect(await fails(c, line.replace("1, $5", "3, $5"), args(3, "ç".repeat(140)))).toBe("OK");
      expect(await fails(c, line.replace("1, $5", "4, $5"), args(4, ""))).toBe("order_lines_kitchen_note");
      expect(await fails(c, line.replace("1, $5", "5, $5"), args(5, "a".repeat(141)))).toBe(
        "order_lines_kitchen_note",
      );
      expect(await fails(c, "update order_lines set kitchen_note = 'ao ponto'")).toMatch(/APPEND_ONLY/);
    });
  });

  it("motivo novo Lançado errado", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId);
      expect(
        await fails(
          c,
          "update orders set status = 'CANCELLED', cancel_reason = 'ENTERED_BY_MISTAKE' where id = $1",
          [ID(5)],
        ),
      ).toBe("OK");
    });
  });
});
