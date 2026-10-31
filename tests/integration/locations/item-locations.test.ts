import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { addMember, newRestaurant, subgroupId, testDb, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { d } from "../../../src/domain/shared/decimal";
import { withTenantTx } from "../../../src/infra/db/db";
import { createItem } from "../../../src/application/inventory/create-item";
import { createLocation, getCountSheet } from "../../../src/application/inventory/locations";
import { setItemLocations } from "../../../src/application/inventory/set-item-locations";
import { getItem } from "../../../src/application/inventory/get-item";

async function setup() {
  const env = testEnv();
  const ctx = await newRestaurant(env);
  const camara = await createLocation(env.deps, ctx, {
    name: "Câmara de carnes",
    kind: "CHILLED",
    tempMinC: d(0),
    tempMaxC: d(4),
    responsibleUserId: null,
    countOrder: 1,
  });
  const seco = await createLocation(env.deps, ctx, {
    name: "Despensa seca",
    kind: "DRY",
    tempMinC: null,
    tempMaxC: null,
    responsibleUserId: null,
    countOrder: 2,
  });
  const quimicos = await createLocation(env.deps, ctx, {
    name: "Armário de limpeza",
    kind: "CHEMICALS",
    tempMinC: null,
    tempMaxC: null,
    responsibleUserId: null,
    countOrder: 3,
  });
  if (!camara.ok || !seco.ok || !quimicos.ok) throw new Error();
  return { env, ctx, camara: camara.value.id, seco: seco.value.id, quimicos: quimicos.value.id };
}

describe("vínculo item × local (spec 001, US3)", () => {
  it("recusa detergente na câmara e alimento no armário de limpeza (cenário 3.4)", async () => {
    const { env, ctx, camara, quimicos } = await setup();
    const det = await createItem(
      env.deps,
      ctx,
      itemData({
        subgroupId: await subgroupId(env, ctx, "12", "02"),
        description: "Detergente neutro",
        type: "CONSUMABLE",
        stockUnit: "l",
        recipeUnit: "ml",
        purchaseUnitLabel: "Galão 5 l",
        purchaseFactor: d(5),
      }),
    );
    const tomate = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: await subgroupId(env, ctx, "01", "02") }),
    );
    if (!det.ok || !tomate.ok) throw new Error();
    const r1 = await setItemLocations(env.deps, ctx, det.value.id, [
      { locationId: camara, isDefault: true, sheetPosition: 1 },
    ]);
    expect(!r1.ok && r1.error.code).toBe("LOCATION_INCOMPATIBLE");
    expect(!r1.ok && r1.error.details?.locationId).toBe(camara);
    expect(
      (
        await setItemLocations(env.deps, ctx, det.value.id, [
          { locationId: quimicos, isDefault: true, sheetPosition: 1 },
        ])
      ).ok,
    ).toBe(true);
    const r2 = await setItemLocations(env.deps, ctx, tomate.value.id, [
      { locationId: quimicos, isDefault: false, sheetPosition: 1 },
    ]);
    expect(!r2.ok && r2.error.code).toBe("LOCATION_INCOMPATIBLE");
  });

  it("no máximo um local padrão por item, também no banco (cenário 3.5)", async () => {
    const { env, ctx, camara, seco } = await setup();
    const item = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: await subgroupId(env, ctx, "01", "02") }),
    );
    if (!item.ok) throw new Error();
    const r = await setItemLocations(env.deps, ctx, item.value.id, [
      { locationId: camara, isDefault: true, sheetPosition: 1 },
      { locationId: seco, isDefault: true, sheetPosition: 1 },
    ]);
    expect(!r.ok && r.error.code).toBe("MULTIPLE_DEFAULTS");

    expect(
      (
        await setItemLocations(env.deps, ctx, item.value.id, [
          { locationId: camara, isDefault: true, sheetPosition: 1 },
          { locationId: seco, isDefault: false, sheetPosition: 4 },
        ])
      ).ok,
    ).toBe(true);
    const view = await getItem(env.deps, ctx, item.value.id);
    expect(view.ok && view.value.locations.map((l) => [l.locationName, l.isDefault])).toEqual([
      ["Câmara de carnes", true],
      ["Despensa seca", false],
    ]);

    const e = await withTenantTx(testDb(), ctx.restaurantId, (tx) =>
      tx.execute(sql`update item_locations set is_default = true where item_id = ${item.value.id}`),
    ).catch((x: Error) => x);
    expect(String((e as Error).cause)).toMatch(/item_locations_one_default/);
  });

  it("folha de contagem lista itens ativos na ordem da posição (cenário 3.6)", async () => {
    const { env, ctx, camara } = await setup();
    const sub = await subgroupId(env, ctx, "02", "01");
    const ids: string[] = [];
    for (const [desc, pos] of [
      ["Picanha", 3],
      ["Alcatra", 1],
      ["Filé mignon", 2],
    ] as const) {
      const r = await createItem(env.deps, ctx, itemData({ subgroupId: sub, description: desc }));
      if (!r.ok) throw new Error();
      ids.push(r.value.id);
      await setItemLocations(env.deps, ctx, r.value.id, [
        { locationId: camara, isDefault: true, sheetPosition: pos },
      ]);
    }
    const sheet = await getCountSheet(env.deps, ctx, camara);
    expect(sheet.ok && sheet.value.rows.map((r) => [r.sheetPosition, r.description])).toEqual([
      [1, "Alcatra"],
      [2, "Filé mignon"],
      [3, "Picanha"],
    ]);
  });

  it("chef não altera vínculos; local inativo não recebe vínculo", async () => {
    const { env, ctx, camara } = await setup();
    const chef = await addMember(env, ctx, ["CHEF"]);
    const item = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: await subgroupId(env, ctx, "01", "02") }),
    );
    if (!item.ok) throw new Error();
    const r = await setItemLocations(env.deps, chef, item.value.id, [
      { locationId: camara, isDefault: true, sheetPosition: 1 },
    ]);
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });
});
