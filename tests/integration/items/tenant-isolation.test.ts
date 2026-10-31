import { describe, it, expect } from "vitest";
import { newRestaurant, subgroupId, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { getItem } from "../../../src/application/inventory/get-item";
import { listItems } from "../../../src/application/inventory/list-items";
import { updateItem } from "../../../src/application/inventory/update-item";

describe("isolamento de itens entre restaurantes (SC-003)", () => {
  it("usuário de B não vê, não lista e não altera item de A", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    const subA = await subgroupId(env, a, "01", "02");
    const item = await createItem(env.deps, a, itemData({ subgroupId: subA }));
    if (!item.ok) throw new Error();

    const got = await getItem(env.deps, b, item.value.id);
    expect(!got.ok && got.error.code).toBe("NOT_FOUND");

    const list = await listItems(env.deps, b, { page: 1 });
    expect(list.ok && list.value.total).toBe(0);

    const upd = await updateItem(
      env.deps,
      b,
      item.value.id,
      1,
      itemData({ subgroupId: await subgroupId(env, b, "01", "02") }),
    );
    expect(!upd.ok && upd.error.code).toBe("NOT_FOUND");

    const stillA = await getItem(env.deps, a, item.value.id);
    expect(stillA.ok).toBe(true);
  });
});
