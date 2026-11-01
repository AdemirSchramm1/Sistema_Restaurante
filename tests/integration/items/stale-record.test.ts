import { describe, it, expect } from "vitest";
import { newRestaurant, subgroupId, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { updateItem } from "../../../src/application/inventory/update-item";

describe("edição concorrente do mesmo item (FR-031)", () => {
  it("o segundo a salvar com a mesma versão recebe STALE_RECORD", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const sub = await subgroupId(env, ctx, "01", "02");
    const created = await createItem(env.deps, ctx, itemData({ subgroupId: sub }));
    if (!created.ok) throw new Error();
    const first = await updateItem(
      env.deps,
      ctx,
      created.value.id,
      1,
      itemData({ subgroupId: sub, purchaseUnitLabel: "Saco" }),
    );
    const second = await updateItem(
      env.deps,
      ctx,
      created.value.id,
      1,
      itemData({ subgroupId: sub, purchaseUnitLabel: "Fardo" }),
    );
    expect(first.ok).toBe(true);
    expect(!second.ok && second.error.code).toBe("STALE_RECORD");
  });
});
