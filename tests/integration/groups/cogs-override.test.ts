import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { d } from "../../../src/domain/shared/decimal";
import { createItem } from "../../../src/application/inventory/create-item";
import { getItem } from "../../../src/application/inventory/get-item";
import { setItemCogsOverride } from "../../../src/application/inventory/set-item-cogs-override";

const detergente = (subgroupId: string) =>
  itemData({
    subgroupId,
    description: "Detergente neutro 5 l",
    type: "CONSUMABLE",
    stockUnit: "l",
    recipeUnit: "ml",
    purchaseUnitLabel: "Galão 5 l",
    purchaseFactor: d(5),
  });

describe("sobrescrever 'entra no CMV' no item (cenário 2.4, FR-024)", () => {
  it("gerente marca item de Higiene e limpeza como CMV, com auditoria, e depois volta a seguir o grupo", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const created = await createItem(env.deps, ctx, detergente(await subgroupId(env, ctx, "12", "02")));
    if (!created.ok) throw new Error();
    const before = await getItem(env.deps, ctx, created.value.id);
    expect(before.ok && before.value.effectiveInCogs).toBe(false);

    expect((await setItemCogsOverride(env.deps, ctx, created.value.id, 1, true)).ok).toBe(true);
    const after = await getItem(env.deps, ctx, created.value.id);
    expect(after.ok && after.value.effectiveInCogs).toBe(true);

    const audit = await ownerTestDb().execute(
      sql`select user_id, changes from audit_log where entity = 'item' and entity_id = ${created.value.id} and action = 'UPDATE'`,
    );
    expect(audit.rows).toEqual([{ user_id: ctx.userId, changes: { inCogsOverride: [null, true] } }]);

    expect((await setItemCogsOverride(env.deps, ctx, created.value.id, 2, null)).ok).toBe(true);
    const reset = await getItem(env.deps, ctx, created.value.id);
    expect(reset.ok && reset.value.effectiveInCogs).toBe(false);
  });

  it("chef não sobrescreve o CMV", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const chef = await addMember(env, manager, ["CHEF"]);
    const created = await createItem(env.deps, chef, detergente(await subgroupId(env, manager, "12", "02")));
    if (!created.ok) throw new Error();
    const r = await setItemCogsOverride(env.deps, chef, created.value.id, 1, true);
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });
});
