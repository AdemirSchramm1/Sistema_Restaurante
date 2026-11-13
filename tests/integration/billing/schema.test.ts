import { describe, it, expect } from "vitest";
import type { PoolClient } from "pg";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";

/** Regras do banco da feature 011 (specs/011-fechamento-conta-mesa/data-model.md). Roda como dono, numa transação desfeita. */
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

const NOW = "2026-11-11T20:00:00Z";
const ID = (n: number) => `0193b000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const TABLE = ID(1);
const ACCESS = ID(2);
const TAB = ID(5);
const ORDER = ID(6);
const ITEM = ID(9);
const PAYMENT = ID(10);

/** Mesa 12 com uma conta aberta, um pedido nela, um item de estoque e um pagamento em Pix. */
async function scenario(c: PoolClient, restaurantId: string, userId: string) {
  await c.query(
    `insert into dining_tables (id, restaurant_id, created_at, updated_at, name, name_normalized, qr_token, qr_rotated_at)
     values ($1, $2, $3, $3, '12', '12', 'tok-011', $3)`,
    [TABLE, restaurantId, NOW],
  );
  await c.query(
    `insert into menu_accesses (id, restaurant_id, created_at, table_id, token_hash, opened_at, expires_at)
     values ($1, $2, $3, $4, 'h-011', $3, $3::timestamptz + interval '20 minutes')`,
    [ACCESS, restaurantId, NOW, TABLE],
  );
  await c.query(
    `insert into table_tabs (id, restaurant_id, created_at, updated_at, table_id, status, opened_at, service_rate)
     values ($1, $2, $3, $3, $4, 'OPEN', $3, 10)`,
    [TAB, restaurantId, NOW, TABLE],
  );
  await c.query(
    `insert into orders (id, restaurant_id, created_at, table_id, menu_access_id, client_request_id, business_day, number,
       status, total, submitted_at, status_changed_at, tab_id)
     values ($1, $2, $3, $4, $5, $1, '2026-11-11', 1, 'RECEIVED', 77, $3, $3, $6)`,
    [ORDER, restaurantId, NOW, TABLE, ACCESS, TAB],
  );
  const sub = await c.query("select id from item_subgroups where restaurant_id = $1 limit 1", [restaurantId]);
  const kg = await c.query("select id from units where code = 'kg'");
  await c.query(
    `insert into items (id, restaurant_id, created_at, updated_at, code, description, description_normalized,
       type, subgroup_id, stock_unit_id)
     values ($1, $2, $3, $3, '01.01.9999', 'Queijo', 'queijo', 'INGREDIENT', $4, $5)`,
    [ITEM, restaurantId, NOW, sub.rows[0].id, kg.rows[0].id],
  );
  await c.query(
    `insert into tab_payments (id, restaurant_id, created_at, created_by, tab_id, method, amount, client_request_id)
     values ($1, $2, $3, $4, $5, 'PIX', 40, $1)`,
    [PAYMENT, restaurantId, NOW, userId, TAB],
  );
}

const closeFields = `closed_at = now(), closed_by = $1, closed_day = '2026-11-11', subtotal = 77, service_charge = 7.70, total = 84.70`;

describe("banco da conta da mesa (spec 011, data-model.md)", () => {
  it("uma conta aberta por mesa; fechada não conta", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      const q = `insert into table_tabs (id, restaurant_id, created_at, updated_at, table_id, status, opened_at,
          closed_at, closed_by, closed_day, subtotal, service_charge, total)
        values ($1, $2, $3, $3, $4, $5, $3, $6, $7, $8, $9, $10, $11)`;
      const open = [null, null, null, null, null, null];
      expect(await fails(c, q, [ID(20), r.restaurantId, NOW, TABLE, "OPEN", ...open])).toBe(
        "table_tabs_one_open",
      );
      const closed = [NOW, r.userId, "2026-11-10", 50, 0, 50];
      expect(await fails(c, q, [ID(21), r.restaurantId, NOW, TABLE, "CLOSED", ...closed])).toBe("OK");
    });
  });

  it("fechada grava quem, quando, o dia e os valores; aberta não tem nada disso", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      expect(await fails(c, "update table_tabs set status = 'CLOSED'")).toBe("table_tabs_closed");
      expect(await fails(c, "update table_tabs set closed_at = now()")).toBe("table_tabs_closed");
      expect(
        await fails(c, `update table_tabs set status = 'CLOSED', ${closeFields.replace("84.70", "80")}`, [
          r.userId,
        ]),
      ).toBe("table_tabs_total");
      expect(await fails(c, `update table_tabs set status = 'CLOSED', ${closeFields}`, [r.userId])).toBe(
        "OK",
      );
    });
  });

  it("taxa de 0 a 20%; restaurante começa com 10%", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      const q = `insert into table_tabs (id, restaurant_id, created_at, updated_at, table_id, status, opened_at, service_rate,
          closed_at, closed_by, closed_day, subtotal, service_charge, total)
        values ($1, $2, $3, $3, $4, 'CLOSED', $3, $5, $3, $6, '2026-11-10', 10, 0, 10)`;
      expect(await fails(c, q, [ID(25), r.restaurantId, NOW, TABLE, 20.01, r.userId])).toBe(
        "table_tabs_service_rate",
      );
      expect(await fails(c, q, [ID(26), r.restaurantId, NOW, TABLE, 20, r.userId])).toBe("OK");
      expect(
        await fails(c, "update restaurants set service_charge_rate = 21 where id = $1", [r.restaurantId]),
      ).toBe("restaurants_service_charge_rate");
      expect(
        await fails(c, "update restaurants set service_charge_rate = null where id = $1", [r.restaurantId]),
      ).toBe("OK");
      const off = await c.query("select service_charge_rate from restaurants where id = $1", [
        r.restaurantId,
      ]);
      expect(off.rows[0].service_charge_rate).toBe(null);
    });
    const fresh = await ownerTestDb().$client.query(
      "select service_charge_rate from restaurants where id = $1",
      [r.restaurantId],
    );
    expect(fresh.rows[0].service_charge_rate).toBe("10.00");
  });

  it("conta não some e não troca de mesa, abertura nem taxa; o resto muda pela trava otimista", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      expect(await fails(c, "delete from table_tabs")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "update table_tabs set table_id = $1", [ID(99)])).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "update table_tabs set opened_at = now()")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "update table_tabs set service_rate = 12")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "update table_tabs set service_waived = true, version = version + 1")).toBe("OK");
    });
  });

  it("pedido pertence a uma conta e não troca de conta", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      expect(await fails(c, "update orders set tab_id = null")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "update orders set status = 'PREPARING', version = 2")).toBe("OK");
    });
  });

  it("pagamento: valor > 0, troco só no dinheiro e recebido = valor + troco; toque duplo não duplica", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      const q = `insert into tab_payments (id, restaurant_id, created_at, created_by, tab_id, method, amount, received, change, client_request_id)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
      const base = [r.restaurantId, NOW, r.userId, TAB];
      expect(await fails(c, q, [ID(30), ...base, "PIX", 0, null, null, ID(30)])).toBe("tab_payments_amount");
      expect(await fails(c, q, [ID(31), ...base, "PIX", 10, 20, 10, ID(31)])).toBe("tab_payments_cash");
      expect(await fails(c, q, [ID(32), ...base, "CASH", 24.93, 50, 25, ID(32)])).toBe("tab_payments_cash");
      expect(await fails(c, q, [ID(33), ...base, "CASH", 24.93, 20, -4.93, ID(33)])).toBe(
        "tab_payments_cash",
      );
      expect(await fails(c, q, [ID(34), ...base, "CASH", 24.93, 50, 25.07, ID(34)])).toBe("OK");
      expect(await fails(c, q, [ID(35), ...base, "PIX", 10, null, null, PAYMENT])).toBe(
        "tab_payments_client_request",
      );
      expect(await fails(c, q, [ID(36), r.restaurantId, NOW, null, TAB, "PIX", 1, null, null, ID(36)])).toBe(
        "tab_payments_by",
      );
    });
  });

  it("pagamento, pagamento tirado e histórico são só inserção; um pagamento é tirado uma vez", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      const removal = `insert into tab_payment_removals (id, restaurant_id, created_at, created_by, payment_id) values ($1, $2, $3, $4, $5)`;
      expect(await fails(c, removal, [ID(40), r.restaurantId, NOW, r.userId, PAYMENT])).toBe("OK");
      expect(await fails(c, removal, [ID(41), r.restaurantId, NOW, r.userId, PAYMENT])).toBe(
        "tab_payment_removals_payment",
      );
      await c.query(
        `insert into tab_events (id, restaurant_id, created_at, tab_id, kind, at) values ($1, $2, $3, $4, 'OPENED', $3)`,
        [ID(42), r.restaurantId, NOW, TAB],
      );
      for (const t of ["tab_payments", "tab_payment_removals", "tab_events"]) {
        expect(await fails(c, `update ${t} set created_at = now()`), t).toMatch(/APPEND_ONLY/);
        expect(await fails(c, `delete from ${t}`), t).toMatch(/APPEND_ONLY/);
      }
    });
  });

  it("histórico: reabrir exige motivo de 1 a 140 letras; só a abertura pelo cliente fica sem pessoa", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      const q = `insert into tab_events (id, restaurant_id, created_at, tab_id, kind, reason, user_id, at)
        values ($1, $2, $3, $4, $5, $6, $7, $3)`;
      const base = [r.restaurantId, NOW, TAB];
      expect(await fails(c, q, [ID(50), ...base, "REOPENED", null, r.userId])).toBe("tab_events_reason");
      expect(await fails(c, q, [ID(51), ...base, "CLOSED", "porque sim", r.userId])).toBe(
        "tab_events_reason",
      );
      expect(await fails(c, q, [ID(52), ...base, "REOPENED", "x".repeat(141), r.userId])).toBe(
        "tab_events_reason_length",
      );
      expect(await fails(c, q, [ID(53), ...base, "PAYMENT_ADDED", null, null])).toBe("tab_events_user");
      expect(await fails(c, q, [ID(54), ...base, "REOPENED", "Pix lançado errado", r.userId])).toBe("OK");
      expect(await fails(c, q, [ID(55), ...base, "OPENED", null, null])).toBe("OK");
    });
  });

  it("acesso encerrado diz por quê: QR code lido de novo ou conta fechada", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      expect(await fails(c, "update menu_accesses set ended_at = now()")).toBe("menu_accesses_end_reason");
      expect(await fails(c, "update menu_accesses set end_reason = 'TAB_CLOSED'")).toBe(
        "menu_accesses_end_reason",
      );
      expect(await fails(c, "update menu_accesses set ended_at = now(), end_reason = 'TAB_CLOSED'")).toBe(
        "OK",
      );
    });
  });

  it("venda no livro: sai com o pedido, sem motivo, uma vez por pedido e item", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      const q = `insert into stock_movements (id, restaurant_id, created_at, created_by, type, item_id, quantity, entered_quantity,
          entered_unit, unit_cost, total_cost, reason_id, occurred_at, order_id, reverses_id)
        values ($1, $2, $3, $4, $5, $6, $7, 0.14, 'kg', 50, $8, $9, $3, $10, $11)`;
      const base = [r.restaurantId, NOW, r.userId];
      expect(await fails(c, q, [ID(60), ...base, "SALE_RECIPE", ITEM, -0.14, -7, null, null, null])).toBe(
        "stock_movements_sale_order",
      );
      expect(await fails(c, q, [ID(61), ...base, "SALE_RECIPE", ITEM, 0.14, 7, null, ORDER, null])).toBe(
        "stock_movements_sale_out",
      );
      const reason = "0193a100-0000-7000-8000-000000000012";
      expect(await fails(c, q, [ID(62), ...base, "SALE_RECIPE", ITEM, -0.14, -7, reason, ORDER, null])).toBe(
        "stock_movements_reason",
      );
      expect(await fails(c, q, [ID(63), ...base, "SALE_RECIPE", ITEM, -0.14, -7, null, ORDER, null])).toBe(
        "OK",
      );
      expect(await fails(c, q, [ID(64), ...base, "SALE_RECIPE", ITEM, -0.1, -5, null, ORDER, null])).toBe(
        "stock_movements_sale_once",
      );
      const reversal = "0193a100-0000-7000-8000-000000000034";
      expect(await fails(c, q, [ID(65), ...base, "REVERSAL", ITEM, 0.14, 7, reversal, ORDER, ID(63)])).toBe(
        "OK",
      );
      expect(await fails(c, q, [ID(66), ...base, "LOSS", ITEM, -0.14, -7, reason, ORDER, null])).toBe("OK");
      expect(await fails(c, q, [ID(67), ...base, "PURCHASE", ITEM, 1, 50, null, ORDER, null])).toBe(
        "stock_movements_order_type",
      );
    });
  });

  it("papel Caixa, venda no livro e motivos 'Pedido cancelado' existem no banco", async () => {
    const db = ownerTestDb().$client;
    expect((await db.query("select enum_range(null::role)::text as v")).rows[0].v).toContain("CASHIER");
    expect((await db.query("select enum_range(null::movement_type)::text as v")).rows[0].v).toContain(
      "SALE_RECIPE",
    );
    const reasons = await db.query(
      "select movement_type::text as type, label, family, position from movement_reasons where code = 'ORDER_CANCELLED' order by position",
    );
    expect(reasons.rows).toEqual([
      { type: "LOSS", label: "Pedido cancelado", family: "OPERATIONAL", position: 19 },
      { type: "REVERSAL", label: "Pedido cancelado", family: "REVERSAL", position: 20 },
    ]);
  });
});
