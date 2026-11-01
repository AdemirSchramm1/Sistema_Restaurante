import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, subgroupId, testDb, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { updateItem } from "../../../src/application/inventory/update-item";
import { withTenantTx } from "../../../src/infra/db/db";
import { UNIT_IDS } from "../../../src/infra/db/repositories/util";

describe("unidade de estoque bloqueada após a 1ª movimentação (FR-023, research R8)", () => {
  it("recusa trocar a unidade pelo caso de uso e pelo SQL direto", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const sub = await subgroupId(env, ctx, "01", "02");
    const created = await createItem(env.deps, ctx, itemData({ subgroupId: sub }));
    if (!created.ok) throw new Error();
    // A feature 003 preenche esta coluna na 1ª movimentação; aqui simulamos.
    await ownerTestDb().execute(
      sql`update items set stock_unit_locked_at = now() where id = ${created.value.id}`,
    );

    const r = await updateItem(
      env.deps,
      ctx,
      created.value.id,
      1,
      itemData({ subgroupId: sub, stockUnit: "un" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("ITEM_UNIT_LOCKED");

    const sqlError = await withTenantTx(testDb(), ctx.restaurantId, (tx) =>
      tx.execute(sql`update items set stock_unit_id = ${UNIT_IDS.un} where id = ${created.value.id}`),
    ).catch((e: Error) => e);
    expect(String((sqlError as Error).cause)).toMatch(/ITEM_UNIT_LOCKED/);
  });

  it("permite trocar a unidade antes de qualquer movimentação", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const sub = await subgroupId(env, ctx, "01", "02");
    const created = await createItem(env.deps, ctx, itemData({ subgroupId: sub }));
    if (!created.ok) throw new Error();
    const r = await updateItem(
      env.deps,
      ctx,
      created.value.id,
      1,
      itemData({ subgroupId: sub, stockUnit: "un" }),
    );
    expect(r.ok).toBe(true);
  });
});
