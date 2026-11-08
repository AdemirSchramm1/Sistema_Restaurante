import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import {
  createTable,
  createTablesInRange,
  listTables,
  renameTable,
  rotateTableQr,
  setTableActive,
  tableQrCodes,
} from "../../../src/application/ordering/tables";

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

describe("mesas e QR codes (spec 009, US1)", () => {
  it("cria mesa, recusa o mesmo nome sem diferenciar maiúsculas e acentos e lista em ordem natural", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    unwrap(await createTable(env.deps, m, { name: "10" }));
    unwrap(await createTable(env.deps, m, { name: "2" }));
    unwrap(await createTable(env.deps, m, { name: "Varanda" }));
    expect(code(await createTable(env.deps, m, { name: " varandá " }))).toBe("TABLE_NAME_IN_USE");
    expect(code(await createTable(env.deps, m, { name: "" }))).toBe("INVALID_TABLE_NAME");
    expect(code(await createTable(env.deps, m, { name: "x".repeat(31) }))).toBe("INVALID_TABLE_NAME");

    const list = unwrap(await listTables(env.deps, m, {}));
    expect(list.map((t) => t.name)).toEqual(["2", "10", "Varanda"]);
    expect(list[0]).toEqual({ id: expect.any(String), name: "2", active: true, version: 1 });
  });

  it("cria uma faixa de mesas e pula as que já existem", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    unwrap(await createTable(env.deps, m, { name: "5" }));
    expect(unwrap(await createTablesInRange(env.deps, m, { from: 1, to: 20 }))).toEqual({
      created: 19,
      skipped: ["5"],
    });
    expect(unwrap(await listTables(env.deps, m, {}))).toHaveLength(20);
    expect(code(await createTablesInRange(env.deps, m, { from: 1, to: 300 }))).toBe("INVALID_RANGE");
    expect(code(await createTablesInRange(env.deps, m, { from: 0, to: 3 }))).toBe("INVALID_RANGE");
  });

  it("renomeia e inativa com trava otimista; mesa inativa libera o nome", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const { id } = unwrap(await createTable(env.deps, m, { name: "1" }));
    unwrap(await renameTable(env.deps, m, { id, name: "Balcão", version: 1 }));
    expect(code(await renameTable(env.deps, m, { id, name: "Outro", version: 1 }))).toBe("STALE_RECORD");
    unwrap(await setTableActive(env.deps, m, { id, active: false, version: 2 }));
    unwrap(await createTable(env.deps, m, { name: "Balcão" }));
    expect(code(await setTableActive(env.deps, m, { id, active: true, version: 3 }))).toBe(
      "TABLE_NAME_IN_USE",
    );
    expect(code(await renameTable(env.deps, m, { id: crypto.randomUUID(), name: "x", version: 1 }))).toBe(
      "NOT_FOUND",
    );
    expect(unwrap(await listTables(env.deps, m, {})).map((t) => t.name)).toEqual(["Balcão"]);
    expect(unwrap(await listTables(env.deps, m, { includeInactive: true }))).toHaveLength(2);
  });

  it("QR code com o link da mesa; trocar o QR code invalida o antigo", async () => {
    const env = testEnv();
    const m = await newRestaurant(env, "Cantina da Nona");
    const { id } = unwrap(await createTable(env.deps, m, { name: "12" }));
    const before = unwrap(await tableQrCodes(env.deps, m, {}));
    expect(before.restaurantName).toBe("Cantina da Nona");
    const [qr] = before.tables;
    expect(qr!.name).toBe("12");
    expect(qr!.url).toMatch(/^http:\/\/localhost:3000\/m\/[A-Za-z0-9_-]{43}$/);
    expect(qr!.svg.startsWith("<svg")).toBe(true);
    const oldToken = qr!.url.split("/m/")[1]!;
    await expect(env.deps.global.tableByQrToken(oldToken)).resolves.toMatchObject({ tableId: id });

    unwrap(await rotateTableQr(env.deps, m, { id, version: 1 }));
    await expect(env.deps.global.tableByQrToken(oldToken)).resolves.toBeNull();
    const after = unwrap(await tableQrCodes(env.deps, m, { ids: [id] }));
    expect(after.tables[0]!.url).not.toBe(qr!.url);
    expect(code(await rotateTableQr(env.deps, m, { id, version: 1 }))).toBe("STALE_RECORD");

    const audit = await ownerTestDb().$client.query<{ action: string; changes: Record<string, unknown> }>(
      "select action, changes from audit_log where entity = 'dining_table' and entity_id = $1 order by occurred_at, id",
      [id],
    );
    expect(audit.rows.map((r) => r.action)).toEqual(["CREATE", "UPDATE"]);
    expect(Object.keys(audit.rows[1]!.changes)).toEqual(["qrRotatedAt"]);
    expect(JSON.stringify(audit.rows)).not.toContain(oldToken);
  });

  it("só o gerente cuida das mesas; tentativa negada vai para a auditoria", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const chef = await addMember(env, m, ["CHEF"]);
    const waiter = await addMember(env, m, ["WAITER"]);
    expect(code(await createTable(env.deps, chef, { name: "1" }))).toBe("FORBIDDEN");
    expect(code(await listTables(env.deps, waiter, {}))).toBe("FORBIDDEN");
    expect(code(await tableQrCodes(env.deps, chef, {}))).toBe("FORBIDDEN");
    const denied = await ownerTestDb().$client.query(
      "select user_id from audit_log where entity = 'dining_table' and action = 'DENIED' and restaurant_id = $1",
      [m.restaurantId],
    );
    expect(denied.rows.map((r) => r.user_id).sort()).toEqual(
      [chef.userId, chef.userId, waiter.userId].sort(),
    );
  });
});
