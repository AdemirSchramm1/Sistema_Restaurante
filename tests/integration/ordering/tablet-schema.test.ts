import { describe, it, expect } from "vitest";
import type { PoolClient } from "pg";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";

/**
 * Regras do banco da feature 016 (specs/016-cardapio-tablet-mesa/data-model.md): logo e capa do
 * restaurante, link do tablet da mesa, acesso do tablet sem prazo e a origem "tablet" do pedido.
 * Roda como dono, numa transação desfeita.
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
const ID = (n: number) => `0193a016-0000-7000-8000-${String(n).padStart(12, "0")}`;

const table = (c: PoolClient, id: string, restaurantId: string, name: string) =>
  c.query(
    `insert into dining_tables (id, restaurant_id, created_at, updated_at, name, name_normalized, qr_token, qr_rotated_at)
     values ($1, $2, $3, $3, $4, $4, $5, $3)`,
    [id, restaurantId, NOW, name, `qr-${id}`],
  );

const access = `insert into menu_accesses (id, restaurant_id, created_at, table_id, token_hash, opened_at, expires_at, kind)
  values ($1, $2, $3, $4, $5, $3, $6, $7)`;

describe("banco do tablet da mesa e da aparência (spec 016, data-model.md)", () => {
  it("logo e capa: base e larguras juntas, com pelo menos uma largura", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      const set = (cols: string, values: unknown[]) =>
        fails(c, `update restaurants set ${cols} where id = $1`, [r.restaurantId, ...values]);
      expect(await set("logo_base = $2, logo_widths = $3", ["r/logo-1", [96, 192]])).toBe("OK");
      expect(await set("logo_base = $2, logo_widths = null", ["r/logo-1"])).toBe("restaurants_logo_pair");
      expect(await set("logo_base = $2, logo_widths = $3", ["r/logo-1", []])).toBe("restaurants_logo_pair");
      expect(await set("cover_base = $2, cover_widths = $3", ["r/capa-1", [600, 1200, 1920]])).toBe("OK");
      expect(await set("cover_base = null, cover_widths = $2", [[600]])).toBe("restaurants_cover_pair");
      expect(
        await set("logo_base = null, logo_widths = null, cover_base = null, cover_widths = null", []),
      ).toBe("OK");
    });
  });

  it("link do tablet: nulo até criar, único e com a data junto", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await table(c, ID(1), r.restaurantId, "12");
      await table(c, ID(2), r.restaurantId, "4");
      const row = (
        await c.query("select tablet_token, tablet_token_rotated_at from dining_tables where id = $1", [
          ID(1),
        ])
      ).rows[0];
      expect(row).toEqual({ tablet_token: null, tablet_token_rotated_at: null });
      const link = (id: string, token: string | null, at: string | null) =>
        fails(c, "update dining_tables set tablet_token = $2, tablet_token_rotated_at = $3 where id = $1", [
          id,
          token,
          at,
        ]);
      expect(await link(ID(1), "tab-1", NOW)).toBe("OK");
      expect(await link(ID(2), "tab-1", NOW)).toBe("dining_tables_tablet_token_unique");
      expect(await link(ID(2), "tab-2", null)).toBe("dining_tables_tablet_token_pair");
    });
  });

  it("acesso do tablet: sem prazo, um por mesa enquanto aberto, sinal de vida só no tablet", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await table(c, ID(1), r.restaurantId, "12");
      await table(c, ID(2), r.restaurantId, "4");
      const in20 = "2026-11-17T20:20:00Z";
      expect(await fails(c, access, [ID(10), r.restaurantId, NOW, ID(1), "h10", in20, "QR"])).toBe("OK");
      expect(await fails(c, access, [ID(11), r.restaurantId, NOW, ID(1), "h11", null, "QR"])).toBe(
        "menu_accesses_expiry_by_kind",
      );
      expect(await fails(c, access, [ID(12), r.restaurantId, NOW, ID(1), "h12", in20, "TABLET"])).toBe(
        "menu_accesses_expiry_by_kind",
      );
      expect(await fails(c, access, [ID(13), r.restaurantId, NOW, ID(1), "h13", null, "TABLET"])).toBe("OK");
      expect(await fails(c, access, [ID(14), r.restaurantId, NOW, ID(1), "h14", null, "TABLET"])).toBe(
        "menu_accesses_one_tablet",
      );
      expect(await fails(c, access, [ID(15), r.restaurantId, NOW, ID(2), "h15", null, "TABLET"])).toBe("OK");
      expect(
        await fails(c, "update menu_accesses set ended_at = $2, end_reason = 'RELEASED' where id = $1", [
          ID(13),
          NOW,
        ]),
      ).toBe("OK");
      expect(await fails(c, access, [ID(14), r.restaurantId, NOW, ID(1), "h14", null, "TABLET"])).toBe("OK");
      expect(await fails(c, "update menu_accesses set last_seen_at = $2 where id = $1", [ID(14), NOW])).toBe(
        "OK",
      );
      expect(await fails(c, "update menu_accesses set last_seen_at = $2 where id = $1", [ID(10), NOW])).toBe(
        "menu_accesses_last_seen",
      );
      expect(
        await fails(c, "update menu_accesses set ended_at = $2, end_reason = 'LINK_ROTATED' where id = $1", [
          ID(15),
          NOW,
        ]),
      ).toBe("OK");
    });
  });

  it("os acessos que já existiam viram QR code", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await table(c, ID(1), r.restaurantId, "12");
      await c.query(
        `insert into menu_accesses (id, restaurant_id, created_at, table_id, token_hash, opened_at, expires_at)
         values ($1, $2, $3, $4, 'h', $3, $3::timestamptz + interval '20 minutes')`,
        [ID(10), r.restaurantId, NOW, ID(1)],
      );
      expect((await c.query("select kind from menu_accesses where id = $1", [ID(10)])).rows[0].kind).toBe(
        "QR",
      );
    });
  });

  it("depois de ligar, tipo, mesa, cookie e abertura do acesso não mudam e nada é apagado", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await table(c, ID(1), r.restaurantId, "12");
      await table(c, ID(2), r.restaurantId, "4");
      await c.query(access, [ID(10), r.restaurantId, NOW, ID(1), "h10", null, "TABLET"]);
      for (const set of [
        "kind = 'QR', expires_at = opened_at + interval '20 minutes'",
        `table_id = '${ID(2)}'`,
        "token_hash = 'outro'",
        "opened_at = opened_at + interval '1 minute'",
      ])
        expect(await fails(c, `update menu_accesses set ${set} where id = $1`, [ID(10)])).toMatch(
          /APPEND_ONLY/,
        );
      expect(await fails(c, "delete from menu_accesses where id = $1", [ID(10)])).toMatch(/APPEND_ONLY/);
    });
  });

  it("pedido do tablet: com o acesso e sem quem lançou; a origem nunca muda", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await table(c, ID(1), r.restaurantId, "12");
      await c.query(access, [ID(10), r.restaurantId, NOW, ID(1), "h10", null, "TABLET"]);
      const order = `insert into orders (id, restaurant_id, created_at, table_id, menu_access_id, client_request_id,
          business_day, number, status, total, submitted_at, status_changed_at, source)
        values ($1, $2, $3, $4, $5, $1, '2026-11-17', $6, 'RECEIVED', 30, $3, $3, 'TABLET')`;
      expect(await fails(c, order, [ID(20), r.restaurantId, NOW, ID(1), ID(10), 1])).toBe("OK");
      expect(await fails(c, order, [ID(21), r.restaurantId, NOW, ID(1), null, 2])).toBe(
        "orders_source_shape",
      );
      expect(await fails(c, "update orders set source = 'QR' where id = $1", [ID(20)])).toMatch(
        /APPEND_ONLY/,
      );
    });
  });

  it("funções da rota pública: mesa pelo link do tablet e o tipo do acesso pelo cookie", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await table(c, ID(1), r.restaurantId, "12");
      await c.query(
        "update dining_tables set tablet_token = 'tab-xyz', tablet_token_rotated_at = $2 where id = $1",
        [ID(1), NOW],
      );
      await c.query(access, [ID(10), r.restaurantId, NOW, ID(1), "h10", null, "TABLET"]);
      expect((await c.query("select * from app_table_by_tablet_token('tab-xyz')")).rows).toEqual([
        { restaurant_id: r.restaurantId, table_id: ID(1), active: true },
      ]);
      expect((await c.query("select * from app_table_by_tablet_token('nada')")).rows).toEqual([]);
      expect((await c.query("select * from app_menu_access_by_token_hash('h10')")).rows).toEqual([
        { restaurant_id: r.restaurantId, menu_access_id: ID(10), kind: "TABLET" },
      ]);
    });
  });
});
