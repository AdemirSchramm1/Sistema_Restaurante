import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { addMember, newRestaurant, subgroupId, testDb, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { d } from "../../../src/domain/shared/decimal";
import { withTenantTx } from "../../../src/infra/db/db";
import { createItem } from "../../../src/application/inventory/create-item";
import { createLocation, setLocationActive } from "../../../src/application/inventory/locations";
import { setItemLocations } from "../../../src/application/inventory/set-item-locations";
import { getItem } from "../../../src/application/inventory/get-item";

async function setup() {
  const env = testEnv();
  const ctx = await newRestaurant(env);
  const geladeira = await createLocation(env.deps, ctx, { name: "Geladeira", kind: "CHILLED" });
  const seco = await createLocation(env.deps, ctx, { name: "Despensa seca", kind: "DRY" });
  const limpeza = await createLocation(env.deps, ctx, { name: "Armário de limpeza", kind: "CHEMICALS" });
  if (!geladeira.ok || !seco.ok || !limpeza.ok) throw new Error();
  return { env, ctx, geladeira: geladeira.value.id, seco: seco.value.id, limpeza: limpeza.value.id };
}

describe("onde o item fica guardado (spec 002, US2)", () => {
  it("não bloqueia combinações de local: a regra de químicos da Anvisa saiu", async () => {
    const { env, ctx, geladeira, limpeza } = await setup();
    const det = await createItem(
      env.deps,
      ctx,
      itemData({
        subgroupId: await subgroupId(env, ctx, "12", "02"),
        description: "Detergente neutro",
        type: "CONSUMABLE",
        stockUnit: "l",
        purchaseUnitLabel: "Galão",
        purchaseFactor: d(5),
      }),
    );
    if (!det.ok) throw new Error();
    const r = await setItemLocations(env.deps, ctx, det.value.id, [
      { locationId: limpeza, isDefault: true },
      { locationId: geladeira, isDefault: false },
    ]);
    expect(r.ok).toBe(true);
  });

  it("no máximo um local principal por item, também no banco", async () => {
    const { env, ctx, geladeira, seco } = await setup();
    const item = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: await subgroupId(env, ctx, "01", "02") }),
    );
    if (!item.ok) throw new Error();
    const r = await setItemLocations(env.deps, ctx, item.value.id, [
      { locationId: geladeira, isDefault: true },
      { locationId: seco, isDefault: true },
    ]);
    expect(!r.ok && r.error.code).toBe("MULTIPLE_DEFAULTS");

    expect(
      (
        await setItemLocations(env.deps, ctx, item.value.id, [
          { locationId: geladeira, isDefault: true },
          { locationId: seco, isDefault: false },
        ])
      ).ok,
    ).toBe(true);
    const view = await getItem(env.deps, ctx, item.value.id);
    expect(view.ok && view.value.locations.map((l) => [l.locationName, l.isDefault])).toEqual([
      ["Despensa seca", false],
      ["Geladeira", true],
    ]);

    const e = await withTenantTx(testDb(), ctx.restaurantId, (tx) =>
      tx.execute(sql`update item_locations set is_default = true where item_id = ${item.value.id}`),
    ).catch((x: Error) => x);
    expect(String((e as Error).cause)).toMatch(/item_locations_one_default/);
  });

  it("chef não altera vínculos; local inativo não recebe vínculo", async () => {
    const { env, ctx, geladeira, seco } = await setup();
    const chef = await addMember(env, ctx, ["CHEF"]);
    const item = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: await subgroupId(env, ctx, "01", "02") }),
    );
    if (!item.ok) throw new Error();
    const r = await setItemLocations(env.deps, chef, item.value.id, [
      { locationId: geladeira, isDefault: true },
    ]);
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect((await setLocationActive(env.deps, ctx, seco, 1, false)).ok).toBe(true);
    const inactive = await setItemLocations(env.deps, ctx, item.value.id, [
      { locationId: seco, isDefault: true },
    ]);
    expect(!inactive.ok && inactive.error.code).toBe("LOCATION_INACTIVE");
  });
});
