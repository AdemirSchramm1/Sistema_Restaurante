import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";

describe("permissões no cadastro de item (FR-003)", () => {
  it("estoquista não cadastra item e a tentativa fica registrada", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const stockkeeper = await addMember(env, manager, ["STOCKKEEPER"]);
    const r = await createItem(
      env.deps,
      stockkeeper,
      itemData({ subgroupId: await subgroupId(env, manager, "01", "02") }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
    const denied = await ownerTestDb().execute(
      sql`select entity, action, user_id from audit_log where action = 'DENIED'`,
    );
    expect(denied.rows).toEqual([{ entity: "item", action: "DENIED", user_id: stockkeeper.userId }]);
  });

  it("chef cadastra item", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const chef = await addMember(env, manager, ["CHEF"]);
    const r = await createItem(
      env.deps,
      chef,
      itemData({ subgroupId: await subgroupId(env, manager, "01", "02") }),
    );
    expect(r.ok).toBe(true);
  });
});
