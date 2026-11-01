import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, subgroupId, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { getItem } from "../../../src/application/inventory/get-item";
import { listItems } from "../../../src/application/inventory/list-items";

describe("cadastrar item (spec 001 US1, simplificado na 002)", () => {
  it("gera 01.02.0001 e 01.02.0002 no subgrupo Hortifrúti > Legumes (cenário 1.1)", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const sub = await subgroupId(env, ctx, "01", "02");

    const a = await createItem(env.deps, ctx, itemData({ subgroupId: sub }));
    const b = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: sub, description: "Cebola branca" }),
    );
    expect(a.ok && a.value.code).toBe("01.02.0001");
    expect(b.ok && b.value.code).toBe("01.02.0002");

    const got = await getItem(env.deps, ctx, a.ok ? a.value.id : "");
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect(got.value.item.stockUnit).toBe("kg");
      expect(got.value.item.purchaseFactor?.toString()).toBe("20");
      expect(got.value.purchaseSummary).toBe("1 Caixa = 20 kg");
    }

    const list = await listItems(env.deps, ctx, { q: "tomate", page: 1 });
    expect(list.ok && list.value.rows.map((r) => r.code)).toEqual(["01.02.0001"]);
  });

  it("10 cadastros simultâneos no mesmo subgrupo geram 10 códigos distintos e em sequência", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const sub = await subgroupId(env, ctx, "01", "03");
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        createItem(env.deps, ctx, itemData({ subgroupId: sub, description: `Fruta número ${i}` })),
      ),
    );
    const codes = results.map((r) => (r.ok ? r.value.code : r.error.code)).sort();
    expect(codes).toEqual(Array.from({ length: 10 }, (_, i) => `01.03.${String(i + 1).padStart(4, "0")}`));
  });

  it("recusa descrição normalizada repetida no mesmo subgrupo e mostra o código existente (cenário 1.4)", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const sub = await subgroupId(env, ctx, "01", "02");
    await createItem(env.deps, ctx, itemData({ subgroupId: sub }));
    const dup = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: sub, description: "tomate  ITALIANO" }),
    );
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.error.code).toBe("ITEM_DUPLICATE_DESCRIPTION");
      expect(dup.error.details?.existingCode).toBe("01.02.0001");
    }
  });

  it("aceita a mesma descrição em outro subgrupo", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    await createItem(env.deps, ctx, itemData({ subgroupId: await subgroupId(env, ctx, "01", "02") }));
    const other = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: await subgroupId(env, ctx, "01", "03") }),
    );
    expect(other.ok).toBe(true);
  });

  it("não consome número do subgrupo quando o cadastro é recusado", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const sub = await subgroupId(env, ctx, "01", "02");
    await createItem(env.deps, ctx, itemData({ subgroupId: sub }));
    await createItem(env.deps, ctx, itemData({ subgroupId: sub }));
    const next = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: sub, description: "Pepino japonês" }),
    );
    expect(next.ok && next.value.code).toBe("01.02.0002");
  });

  it("recusa subgrupo inexistente", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const r = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: "0193a000-0000-7000-8000-00000000ffff" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("grava a auditoria de criação com usuário e campos", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const r = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: await subgroupId(env, ctx, "01", "02") }),
    );
    if (!r.ok) throw new Error();
    const rows = await ownerTestDb().execute(
      sql`select action, user_id, changes from audit_log where entity = 'item' and entity_id = ${r.value.id}`,
    );
    expect(rows.rows).toHaveLength(1);
    const row = rows.rows[0] as { action: string; user_id: string; changes: Record<string, unknown> };
    expect(row.action).toBe("CREATE");
    expect(row.user_id).toBe(ctx.userId);
    expect(row.changes.description).toEqual([null, "Tomate italiano"]);
    expect(row.changes.purchaseFactor).toEqual([null, "20"]);
  });

});
