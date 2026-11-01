import { describe, it, expect } from "vitest";
import { newRestaurant, subgroupId, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { setItemActive } from "../../../src/application/inventory/set-item-active";
import { listItems } from "../../../src/application/inventory/list-items";

describe("inativar e reativar item (FR-027)", () => {
  it("item inativo sai da lista de ativos e libera a descrição; reativar com duplicado ativo é recusado", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const sub = await subgroupId(env, ctx, "01", "02");
    const old = await createItem(env.deps, ctx, itemData({ subgroupId: sub }));
    if (!old.ok) throw new Error();

    expect((await setItemActive(env.deps, ctx, old.value.id, 1, false)).ok).toBe(true);
    const active = await listItems(env.deps, ctx, { page: 1, status: "active" });
    expect(active.ok && active.value.total).toBe(0);
    const inactive = await listItems(env.deps, ctx, { page: 1, status: "inactive" });
    expect(inactive.ok && inactive.value.total).toBe(1);

    const replacement = await createItem(env.deps, ctx, itemData({ subgroupId: sub }));
    expect(replacement.ok && replacement.value.code).toBe("01.02.0002");

    const reactivate = await setItemActive(env.deps, ctx, old.value.id, 2, true);
    expect(!reactivate.ok && reactivate.error.code).toBe("ITEM_DUPLICATE_DESCRIPTION");
  });
});
