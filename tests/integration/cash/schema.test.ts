import { describe, it, expect } from "vitest";
import type { PoolClient } from "pg";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, testDb, testEnv } from "../harness";
import { withTenantTx } from "../../../src/infra/db/db";

/** Regras do banco da feature 014 (specs/014-fechamento-caixa/data-model.md). Roda como dono, numa transação desfeita. */
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

const NOW = "2026-11-17T14:02:00Z";
const ID = (n: number) => `0193c000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const SESSION = ID(1);
const TABLE = ID(2);
const TAB = ID(3);
const ENTRY = ID(4);
const COUNT = ID(5);
const PAYMENT = ID(6);
const OLD_PAYMENT = ID(7);

const openSession = `insert into cash_sessions (id, restaurant_id, created_at, created_by, updated_at, status, business_day,
    opened_at, opened_by, opening_float, previous_kept, opening_note, client_request_id)
  values ($1, $2, $3, $4, $3, 'OPEN', '2026-11-17', $3, $4, $5, $6, $7, $1)`;
const entry = `insert into cash_entries (id, restaurant_id, created_at, created_by, cash_session_id, kind, amount, reason, note, client_request_id)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
const count = `insert into cash_counts (id, restaurant_id, created_at, created_by, cash_session_id, counted, session_version)
  values ($1, $2, $3, $4, $5, $6, 1)`;
const payment = `insert into tab_payments (id, restaurant_id, created_at, created_by, tab_id, method, amount, client_request_id, cash_session_id)
  values ($1, $2, $3, $4, $5, 'PIX', 40, $1, $6)`;
const closing = (over: Record<string, string> = {}) => {
  const f: Record<string, string> = {
    status: "'CLOSED'",
    closed_at: "now()",
    closed_by: "$1",
    expected: "127",
    counted: "125",
    difference: "-2",
    kept: "100",
    service_charge: "0",
    closing_count_id: `'${COUNT}'`,
    close_note: "'Troco errado na mesa 4'",
    ...over,
  };
  return `update cash_sessions set ${Object.entries(f)
    .map(([k, v]) => `${k} = ${v}`)
    .join(", ")} where id = '${SESSION}'`;
};

/** Turno aberto com troco de R$ 150,00, uma sangria, uma contagem, mesa 12 com conta e um Pix. */
async function scenario(c: PoolClient, restaurantId: string, userId: string) {
  await c.query(openSession, [SESSION, restaurantId, NOW, userId, 150, null, null]);
  await c.query(entry, [ENTRY, restaurantId, NOW, userId, SESSION, "WITHDRAWAL", 150, "SAFE", null, ENTRY]);
  await c.query(count, [COUNT, restaurantId, NOW, userId, SESSION, 125]);
  await c.query(
    `insert into dining_tables (id, restaurant_id, created_at, updated_at, name, name_normalized, qr_token, qr_rotated_at)
     values ($1, $2, $3, $3, '12', '12', 'tok-014', $3)`,
    [TABLE, restaurantId, NOW],
  );
  await c.query(
    `insert into table_tabs (id, restaurant_id, created_at, updated_at, table_id, status, opened_at)
     values ($1, $2, $3, $3, $4, 'OPEN', $3)`,
    [TAB, restaurantId, NOW, TABLE],
  );
  await c.query(payment, [PAYMENT, restaurantId, NOW, userId, TAB, SESSION]);
}

describe("banco do caixa do dia (spec 014, data-model.md)", () => {
  it("turno: um aberto por restaurante; outro restaurante abre o seu", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    await inTx(async (c) => {
      await scenario(c, a.restaurantId, a.userId);
      expect(await fails(c, openSession, [ID(20), a.restaurantId, NOW, a.userId, 0, null, null])).toBe(
        "cash_sessions_one_open",
      );
      expect(await fails(c, openSession, [ID(21), b.restaurantId, NOW, b.userId, 0, null, null])).toBe("OK");
    });
  });

  it("abertura: troco ≥ 0; observação de 1 a 140, obrigatória se o troco é outro que o que ficou na gaveta", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      const args = (id: number, float: number, kept: number | null, note: string | null) => [
        ID(id),
        r.restaurantId,
        NOW,
        r.userId,
        float,
        kept,
        note,
      ];
      expect(await fails(c, openSession, args(20, -0.01, null, null))).toBe("cash_sessions_opening_float");
      expect(await fails(c, openSession, args(21, 120, 150, null))).toBe("cash_sessions_opening_note");
      expect(await fails(c, openSession, args(22, 120, 150, ""))).toBe("cash_sessions_opening_note_length");
      expect(await fails(c, openSession, args(23, 120, 150, "a".repeat(141)))).toBe(
        "cash_sessions_opening_note_length",
      );
      expect(await fails(c, openSession, args(24, 150, 150, null))).toBe("OK");
    });
    await inTx(async (c) => {
      expect(
        await fails(c, openSession, [
          ID(25),
          r.restaurantId,
          NOW,
          r.userId,
          120,
          150,
          "Levei R$ 30,00 ao cofre",
        ]),
      ).toBe("OK");
    });
  });

  it("fechamento: tudo preenchido só em fechado; diferença = contado − esperado; 0 ≤ fica ≤ contado; observação se há diferença", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      const p = [r.userId];
      expect(await fails(c, `update cash_sessions set status = 'CLOSED'`)).toBe("cash_sessions_closed");
      expect(await fails(c, `update cash_sessions set closed_at = now()`)).toBe("cash_sessions_closed");
      expect(await fails(c, `update cash_sessions set close_note = 'x'`)).toBe("cash_sessions_close_note");
      expect(await fails(c, closing({ kept: "null" }), p)).toBe("cash_sessions_closed");
      expect(await fails(c, closing({ difference: "2" }), p)).toBe("cash_sessions_difference");
      expect(await fails(c, closing({ kept: "125.01" }), p)).toBe("cash_sessions_kept");
      expect(await fails(c, closing({ kept: "-1" }), p)).toBe("cash_sessions_kept");
      expect(await fails(c, closing({ counted: "-1", expected: "1", kept: "-1" }), p)).toBe(
        "cash_sessions_counted",
      );
      expect(await fails(c, closing({ close_note: "null" }), p)).toBe("cash_sessions_close_note");
      expect(await fails(c, closing({ close_note: `'${"a".repeat(141)}'` }), p)).toBe(
        "cash_sessions_close_note_length",
      );
      expect(await fails(c, closing({ counted: "127", difference: "0", close_note: "null" }), p)).toBe("OK");
    });
  });

  it("turno fechado não muda; turno não some e a abertura não muda", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      expect(await fails(c, "delete from cash_sessions")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "update cash_sessions set opening_float = 10")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "update cash_sessions set opened_by = $1", [ID(99)])).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "update cash_sessions set business_day = '2026-11-18'")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "update cash_sessions set version = version + 1")).toBe("OK");
      expect(await fails(c, closing(), [r.userId])).toBe("OK");
      expect(await fails(c, "update cash_sessions set version = version + 1")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "update cash_sessions set close_note = 'outra'")).toMatch(/APPEND_ONLY/);
      expect(await fails(c, "delete from cash_sessions")).toMatch(/APPEND_ONLY/);
    });
  });

  it("sangria e reforço: valor > 0; motivo só na sangria; observação até 140 e obrigatória em Outro; toque duplo não duplica", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      const args = (id: number, kind: string, amount: number, reason: string | null, note: string | null) => [
        ID(id),
        r.restaurantId,
        NOW,
        r.userId,
        SESSION,
        kind,
        amount,
        reason,
        note,
        ID(id),
      ];
      expect(await fails(c, entry, args(20, "SUPPLY", 0, null, null))).toBe("cash_entries_amount");
      expect(await fails(c, entry, args(21, "WITHDRAWAL", 10, null, null))).toBe("cash_entries_reason");
      expect(await fails(c, entry, args(22, "SUPPLY", 10, "SAFE", null))).toBe("cash_entries_reason");
      expect(await fails(c, entry, args(23, "WITHDRAWAL", 10, "OTHER", null))).toBe("cash_entries_note");
      expect(await fails(c, entry, args(24, "SUPPLY", 10, null, "a".repeat(141)))).toBe(
        "cash_entries_note_length",
      );
      expect(await fails(c, entry, args(25, "WITHDRAWAL", 10, "OTHER", "Gelo"))).toBe("OK");
      expect(await fails(c, entry, args(26, "SUPPLY", 50, null, null))).toBe("OK");
      const again = args(27, "SUPPLY", 50, null, null);
      again[9] = ID(26);
      expect(await fails(c, entry, again)).toBe("cash_entries_client_request");
      const nobody = args(28, "SUPPLY", 50, null, null);
      nobody[3] = null as never;
      expect(await fails(c, entry, nobody)).toBe("cash_entries_by");
    });
  });

  it("lançamento, lançamento tirado e contagem são só inserção; um lançamento é tirado uma vez; contado ≥ 0", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      const removal = `insert into cash_entry_removals (id, restaurant_id, created_at, created_by, entry_id) values ($1, $2, $3, $4, $5)`;
      expect(await fails(c, removal, [ID(30), r.restaurantId, NOW, r.userId, ENTRY])).toBe("OK");
      expect(await fails(c, removal, [ID(31), r.restaurantId, NOW, r.userId, ENTRY])).toBe(
        "cash_entry_removals_entry",
      );
      expect(await fails(c, count, [ID(32), r.restaurantId, NOW, r.userId, SESSION, -0.01])).toBe(
        "cash_counts_counted",
      );
      expect(await fails(c, count, [ID(33), r.restaurantId, NOW, r.userId, SESSION, 0])).toBe("OK");
      for (const t of ["cash_entries", "cash_entry_removals", "cash_counts"]) {
        expect(await fails(c, `update ${t} set created_at = now()`), t).toMatch(/APPEND_ONLY/);
        expect(await fails(c, `delete from ${t}`), t).toMatch(/APPEND_ONLY/);
      }
    });
  });

  it("pagamento e pagamento tirado novos exigem o turno; os de antes da 014 continuam válidos", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      expect(await fails(c, payment, [ID(40), r.restaurantId, NOW, r.userId, TAB, null])).toBe(
        "tab_payments_cash_session",
      );
      const removal = `insert into tab_payment_removals (id, restaurant_id, created_at, created_by, payment_id, cash_session_id)
        values ($1, $2, $3, $4, $5, $6)`;
      expect(await fails(c, removal, [ID(41), r.restaurantId, NOW, r.userId, PAYMENT, null])).toBe(
        "tab_payment_removals_cash_session",
      );
      expect(await fails(c, removal, [ID(42), r.restaurantId, NOW, r.userId, PAYMENT, SESSION])).toBe("OK");
      // Linha de antes da 014: entra com a checagem desligada, como as que já estavam no banco.
      await c.query("alter table tab_payments drop constraint tab_payments_cash_session");
      await c.query(payment, [OLD_PAYMENT, r.restaurantId, NOW, r.userId, TAB, null]);
      await c.query(
        "alter table tab_payments add constraint tab_payments_cash_session check (cash_session_id is not null) not valid",
      );
      const old = await c.query("select cash_session_id from tab_payments where id = $1", [OLD_PAYMENT]);
      expect(old.rows[0].cash_session_id).toBeNull();
      expect(await fails(c, payment, [ID(43), r.restaurantId, NOW, r.userId, TAB, null])).toBe(
        "tab_payments_cash_session",
      );
    });
    const valid = await ownerTestDb().$client.query(
      `select conname, convalidated from pg_constraint
       where conname in ('tab_payments_cash_session', 'tab_payment_removals_cash_session') order by conname`,
    );
    expect(valid.rows).toEqual([
      { conname: "tab_payment_removals_cash_session", convalidated: false },
      { conname: "tab_payments_cash_session", convalidated: false },
    ]);
  });

  it("nada entra em turno fechado: pagamento, pagamento tirado, sangria, reforço e contagem", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      expect(await fails(c, closing(), [r.userId])).toBe("OK");
      const base = [r.restaurantId, NOW, r.userId];
      expect(await fails(c, payment, [ID(50), ...base, TAB, SESSION])).toMatch(/CASH_SESSION_CLOSED/);
      expect(
        await fails(
          c,
          `insert into tab_payment_removals (id, restaurant_id, created_at, created_by, payment_id, cash_session_id)
           values ($1, $2, $3, $4, $5, $6)`,
          [ID(51), ...base, PAYMENT, SESSION],
        ),
      ).toMatch(/CASH_SESSION_CLOSED/);
      expect(await fails(c, entry, [ID(52), ...base, SESSION, "SUPPLY", 10, null, null, ID(52)])).toMatch(
        /CASH_SESSION_CLOSED/,
      );
      expect(await fails(c, count, [ID(53), ...base, SESSION, 10])).toMatch(/CASH_SESSION_CLOSED/);
    });
  });

  it("a conta guarda o turno em que fechou", async () => {
    const env = testEnv();
    const r = await newRestaurant(env);
    await inTx(async (c) => {
      await scenario(c, r.restaurantId, r.userId);
      expect(await fails(c, "update table_tabs set cash_session_id = $1", [SESSION])).toBe("OK");
      expect(await fails(c, "update table_tabs set cash_session_id = $1", [ID(99)])).toBe(
        "table_tabs_cash_session_id_cash_sessions_id_fk",
      );
    });
  });

  it("RLS: um restaurante não lê nem grava turno, lançamento, lançamento tirado ou contagem de outro", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    const c = await ownerTestDb().$client.connect();
    try {
      await scenario(c, b.restaurantId, b.userId);
      await c.query(
        "insert into cash_entry_removals (id, restaurant_id, created_at, created_by, entry_id) values ($1, $2, $3, $4, $5)",
        [ID(60), b.restaurantId, NOW, b.userId, ENTRY],
      );
    } finally {
      c.release();
    }
    const tables = ["cash_sessions", "cash_entries", "cash_entry_removals", "cash_counts"];
    await withTenantTx(testDb(), a.restaurantId, async (tx) => {
      for (const t of tables) {
        const seen = await tx.execute(sql.raw(`select count(*)::int as n from ${t}`));
        expect(seen.rows[0]!.n, t).toBe(0);
      }
    });
    await expect(
      withTenantTx(testDb(), a.restaurantId, (tx) =>
        tx.execute(
          sql`insert into cash_counts (id, restaurant_id, created_at, created_by, cash_session_id, counted, session_version)
              values (${ID(61)}, ${b.restaurantId}, ${NOW}, ${a.userId}, ${SESSION}, 1, 1)`,
        ),
      ),
    ).rejects.toThrow();
    await withTenantTx(testDb(), b.restaurantId, async (tx) => {
      for (const t of tables) {
        const seen = await tx.execute(sql.raw(`select count(*)::int as n from ${t}`));
        expect(seen.rows[0]!.n, t).toBe(1);
      }
    });
  });

  it("a aplicação só lê e insere nas tabelas só inserção; o turno ela também atualiza, e nada apaga", async () => {
    const grants = await ownerTestDb().$client.query<{ table_name: string; privileges: string }>(
      `select table_name, string_agg(privilege_type, ',' order by privilege_type) as privileges
       from information_schema.role_table_grants
       where grantee = 'app_user' and table_name like 'cash_%' group by table_name order by table_name`,
    );
    expect(grants.rows).toEqual([
      { table_name: "cash_counts", privileges: "INSERT,SELECT" },
      { table_name: "cash_entries", privileges: "INSERT,SELECT" },
      { table_name: "cash_entry_removals", privileges: "INSERT,SELECT" },
      { table_name: "cash_sessions", privileges: "INSERT,SELECT,UPDATE" },
    ]);
  });
});
