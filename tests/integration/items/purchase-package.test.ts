import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, subgroupId, testDb, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { getItem } from "../../../src/application/inventory/get-item";
import { updateItem } from "../../../src/application/inventory/update-item";
import { withTenantTx } from "../../../src/infra/db/db";
import { d } from "../../../src/domain/shared/decimal";

describe("como você compra é opcional (spec 002, US1)", () => {
  it("grava item comprado solto, sem embalagem (cenário 2)", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const r = await createItem(
      env.deps,
      ctx,
      itemData({
        subgroupId: await subgroupId(env, ctx, "01", "02"),
        description: "Tomate",
        purchaseUnitLabel: null,
        purchaseFactor: null,
      }),
    );
    if (!r.ok) throw new Error(r.error.code);
    const got = await getItem(env.deps, ctx, r.value.id);
    expect(got.ok && got.value.item).toMatchObject({ purchaseUnitLabel: null, purchaseFactor: null });
    expect(got.ok && got.value.purchaseSummary).toBeNull();
  });

  it("grava a embalagem e mostra 1 Saco = 5 kg (cenário 3)", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const r = await createItem(
      env.deps,
      ctx,
      itemData({
        subgroupId: await subgroupId(env, ctx, "05", "01"),
        description: "Arroz branco",
        purchaseUnitLabel: "Saco",
        purchaseFactor: d("5"),
      }),
    );
    if (!r.ok) throw new Error(r.error.code);
    const got = await getItem(env.deps, ctx, r.value.id);
    expect(got.ok && got.value.purchaseSummary).toBe("1 Saco = 5 kg");
  });

  it("embalagem sem quantidade é recusada apontando o campo (cenário 4)", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const r = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: await subgroupId(env, ctx, "01", "02"), purchaseFactor: null }),
    );
    expect(r).toMatchObject({
      ok: false,
      error: { code: "PURCHASE_FACTOR_REQUIRED", field: "purchaseFactor" },
    });
  });

  it("dá para tirar a embalagem depois", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const data = itemData({ subgroupId: await subgroupId(env, ctx, "01", "02") });
    const r = await createItem(env.deps, ctx, data);
    if (!r.ok) throw new Error(r.error.code);
    const u = await updateItem(env.deps, ctx, r.value.id, 1, {
      ...data,
      purchaseUnitLabel: null,
      purchaseFactor: null,
    });
    expect(u.ok).toBe(true);
  });

  it("o banco também exige embalagem e quantidade juntas", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const r = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: await subgroupId(env, ctx, "01", "02") }),
    );
    if (!r.ok) throw new Error(r.error.code);
    const e = await withTenantTx(testDb(), ctx.restaurantId, (tx) =>
      tx.execute(sql`update items set purchase_factor = null where id = ${r.value.id}`),
    ).catch((x: Error) => x);
    expect(String((e as Error).cause)).toMatch(/items_purchase_pair/);
  });
});
