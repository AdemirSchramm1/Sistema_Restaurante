import { beforeEach, describe, expect, it } from "vitest";
import { addMember, newRestaurant, subgroupId, testEnv, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { updateItem } from "../../../src/application/inventory/update-item";
import { searchAudit } from "../../../src/application/audit/search-audit";
import type { RequestContext } from "../../../src/application/context";
import type { AuditEntry } from "../../../src/application/ports";
import { ok } from "../../../src/domain/shared/result";

/** Grava direto na trilha (atalho de teste), na hora do relógio do teste. */
async function record(env: TestEnv, ctx: RequestContext, entry: Partial<AuditEntry> = {}) {
  await env.deps.tenant(ctx.restaurantId, async (repos) => {
    await repos.audit.record({
      entity: "supplier",
      entityId: env.deps.ids.next(),
      action: "CREATE",
      changes: { name: [null, "Fornecedor"] },
      userId: ctx.userId,
      origin: { channel: "test" },
      ...entry,
    });
    return ok(undefined);
  });
}

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};

describe("relatório de auditoria (spec 019, US1)", () => {
  let env: TestEnv;
  let manager: RequestContext;

  beforeEach(async () => {
    env = testEnv();
    // 31/10 às 12h em UTC = 9h em São Paulo.
    manager = await newRestaurant(env);
  });

  it("mostra o que a equipe fez hoje, do mais novo para o mais antigo, com o nome de quem fez", async () => {
    const chef = await addMember(env, manager, ["CHEF"], "Chef Bia");
    const sub = await subgroupId(env, manager, "01", "02");
    const item = unwrap(await createItem(env.deps, manager, itemData({ subgroupId: sub })));
    env.clock.advance(60_000);
    unwrap(
      await updateItem(env.deps, chef, item.id, 1, itemData({ subgroupId: sub, purchaseUnitLabel: "Saco" })),
    );

    const r = unwrap(await searchAudit(env.deps, manager, { tipo: "ITEMS" }));
    expect(r.filter).toMatchObject({ from: "2026-10-31", to: "2026-10-31", type: "ITEMS", page: 1 });
    expect(r.total).toBe(2);
    expect(r.rows.map((e) => [e.entity, e.action, e.userName])).toEqual([
      ["item", "UPDATE", "Chef Bia"],
      ["item", "CREATE", "Gerente"],
    ]);
    expect(r.rows[0]).toMatchObject({
      entityId: item.id,
      changes: { purchaseUnitLabel: ["Caixa", "Saco"] },
      occurredAt: new Date("2026-10-31T12:01:00Z"),
    });
  });

  it("filtra por pessoa, por tipo de operação e só pelas tentativas negadas", async () => {
    const chef = await addMember(env, manager, ["CHEF"], "Chef Bia");
    await record(env, chef, { entity: "supplier" });
    await record(env, chef, { entity: "cash_session", action: "DENIED", changes: { action: "cash.open" } });
    await record(env, manager, { entity: "supplier" });

    const byChef = unwrap(await searchAudit(env.deps, manager, { pessoa: chef.userId }));
    expect(byChef.rows.map((e) => e.entity).sort()).toEqual(["cash_session", "supplier"]);
    expect(byChef.total).toBe(2);

    const suppliers = unwrap(await searchAudit(env.deps, manager, { tipo: "SUPPLIERS" }));
    expect(suppliers.rows.map((e) => e.userName).sort()).toEqual(["Chef Bia", "Gerente"]);

    const denied = unwrap(await searchAudit(env.deps, manager, { negadas: "1" }));
    expect(denied.rows.map((e) => [e.entity, e.userName])).toEqual([["cash_session", "Chef Bia"]]);

    const none = unwrap(await searchAudit(env.deps, manager, { pessoa: chef.userId, tipo: "MENU" }));
    expect(none).toMatchObject({ total: 0, rows: [] });
  });

  it("período em dias do fuso do restaurante, de início ao fim inclusive", async () => {
    // 31/10 02:59 UTC = 30/10 23:59 em São Paulo; 03:00 UTC = 31/10 00:00.
    env.clock.current = new Date("2026-10-31T02:59:59.999Z");
    await record(env, manager, { entity: "menu" });
    env.clock.current = new Date("2026-10-31T03:00:00Z");
    await record(env, manager, { entity: "menu_section" });
    env.clock.current = new Date("2026-10-28T03:00:00Z");
    await record(env, manager, { entity: "menu" });
    env.clock.current = new Date("2026-10-28T02:59:59.999Z");
    await record(env, manager, { entity: "menu" });
    env.clock.current = new Date("2026-10-31T12:00:00Z");

    const day30 = unwrap(await searchAudit(env.deps, manager, { de: "2026-10-30", tipo: "MENU" }));
    expect(day30.rows.map((e) => e.occurredAt.toISOString())).toEqual(["2026-10-31T02:59:59.999Z"]);

    const range = unwrap(
      await searchAudit(env.deps, manager, { de: "2026-10-28", ate: "2026-10-30", tipo: "MENU" }),
    );
    expect(range.rows.map((e) => e.occurredAt.toISOString())).toEqual([
      "2026-10-31T02:59:59.999Z",
      "2026-10-28T03:00:00.000Z",
    ]);
  });

  it("página de 50 em 50 com o total; empate na hora segue a ordem do registro", async () => {
    for (let i = 0; i < 52; i++) {
      await record(env, manager, { entity: "dining_table", changes: { name: [null, `Mesa ${i}`] } });
      env.clock.advance(1000);
    }
    const p1 = unwrap(await searchAudit(env.deps, manager, { tipo: "TABLES" }));
    expect(p1.total).toBe(52);
    expect(p1.rows).toHaveLength(50);
    expect(p1.rows[0]!.changes).toEqual({ name: [null, "Mesa 51"] });
    const p2 = unwrap(await searchAudit(env.deps, manager, { tipo: "TABLES", pagina: "2" }));
    expect(p2.total).toBe(52);
    expect(p2.rows.map((e) => e.changes)).toEqual([{ name: [null, "Mesa 1"] }, { name: [null, "Mesa 0"] }]);
    const p3 = unwrap(await searchAudit(env.deps, manager, { tipo: "TABLES", pagina: "3" }));
    expect(p3).toMatchObject({ total: 52, rows: [] });
  });

  it("registro sem pessoa (sistema ou cliente) aparece sem nome", async () => {
    await record(env, manager, { entity: "order", userId: null });
    const r = unwrap(await searchAudit(env.deps, manager, { tipo: "ORDERS" }));
    expect(r.rows.map((e) => [e.userId, e.userName])).toEqual([[null, null]]);
  });

  it("período inválido diz o problema no campo", async () => {
    expect(await searchAudit(env.deps, manager, { de: "2026-10-31", ate: "2026-10-01" })).toEqual({
      ok: false,
      error: { code: "INVALID_PERIOD", field: "de" },
    });
  });

  it("só o gerente vê; a tentativa negada vai para a trilha", async () => {
    const chef = await addMember(env, manager, ["CHEF"], "Chef Bia");
    const cashier = await addMember(env, manager, ["CASHIER"], "Caixa Ana");
    for (const who of [chef, cashier])
      expect(await searchAudit(env.deps, who, {})).toEqual({
        ok: false,
        error: { code: "FORBIDDEN", details: { action: "audit.read" } },
      });
    const denied = unwrap(await searchAudit(env.deps, manager, { negadas: "1" }));
    expect(denied.rows.map((e) => [e.entity, e.entityId, e.userName, e.changes])).toEqual([
      ["audit_log", null, "Caixa Ana", { action: "audit.read" }],
      ["audit_log", null, "Chef Bia", { action: "audit.read" }],
    ]);
  });

  it("nunca mostra dado de outro restaurante", async () => {
    const other = await newRestaurant(env, "Outro");
    await record(env, other, { entity: "supplier" });
    const r = unwrap(await searchAudit(env.deps, manager, { tipo: "SUPPLIERS" }));
    expect(r).toMatchObject({ total: 0, rows: [] });
  });
});
