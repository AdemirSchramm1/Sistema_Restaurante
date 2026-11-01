import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { addMember, newRestaurant, subgroupId, testDb, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { d } from "../../../src/domain/shared/decimal";
import { withTenantTx } from "../../../src/infra/db/db";
import { createItem } from "../../../src/application/inventory/create-item";
import {
  applySuggestedLocations,
  createLocation,
  listLocations,
  setLocationActive,
  updateLocation,
} from "../../../src/application/inventory/locations";
import { setItemLocations } from "../../../src/application/inventory/set-item-locations";
import type { LocationData } from "../../../src/domain/inventory/location";

const camara: LocationData = {
  name: "Câmara de carnes",
  kind: "CHILLED",
  tempMinC: d(0),
  tempMaxC: d(4),
  responsibleUserId: null,
  countOrder: 1,
};

describe("locais (spec 001, US3)", () => {
  it("quarentena existe desde o início e não inativa (cenário 3.1)", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const list = await listLocations(env.deps, ctx);
    const q = list.ok ? list.value.find((l) => l.kind === "QUARANTINE")! : null;
    expect(q).toMatchObject({ name: "Recebimento / quarentena", isSystem: true });
    const r = await setLocationActive(env.deps, ctx, q!.id, q!.version, false);
    expect(!r.ok && r.error.code).toBe("SYSTEM_RECORD");
  });

  it("refrigerado sem faixa é recusado pelo caso de uso e pelo banco (cenário 3.2)", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const r = await createLocation(env.deps, ctx, { ...camara, tempMinC: null, tempMaxC: null });
    expect(!r.ok && r.error.code).toBe("TEMPERATURE_RANGE_REQUIRED");
    const e = await withTenantTx(testDb(), ctx.restaurantId, (tx) =>
      tx.execute(sql`insert into locations (id, restaurant_id, created_at, updated_at, name, kind)
        values (gen_random_uuid(), ${ctx.restaurantId}, now(), now(), 'Freezer', 'FROZEN')`),
    ).catch((x: Error) => x);
    expect(String((e as Error).cause)).toMatch(/locations_temp_required/);
    expect((await createLocation(env.deps, ctx, camara)).ok).toBe(true);
  });

  it("nome repetido entre ativos é recusado; inativo libera o nome", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const a = await createLocation(env.deps, ctx, camara);
    const dup = await createLocation(env.deps, ctx, { ...camara, name: "câmara de carnes" });
    expect(!dup.ok && dup.error.code).toBe("NAME_IN_USE");
    if (!a.ok) throw new Error();
    expect((await setLocationActive(env.deps, ctx, a.value.id, 1, false)).ok).toBe(true);
    expect((await createLocation(env.deps, ctx, camara)).ok).toBe(true);
  });

  it("responsável precisa ser membro ativo", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const r = await createLocation(env.deps, ctx, {
      ...camara,
      responsibleUserId: "0193a000-0000-7000-8000-00000000abcd",
    });
    expect(!r.ok && r.error.code).toBe("RESPONSIBLE_NOT_MEMBER");
    const chef = await addMember(env, ctx, ["CHEF"]);
    expect((await createLocation(env.deps, ctx, { ...camara, responsibleUserId: chef.userId })).ok).toBe(
      true,
    );
  });

  it("não inativa local com itens vinculados", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const l = await createLocation(env.deps, ctx, camara);
    const item = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: await subgroupId(env, ctx, "02", "01"), description: "Filé mignon" }),
    );
    if (!l.ok || !item.ok) throw new Error();
    await setItemLocations(env.deps, ctx, item.value.id, [
      { locationId: l.value.id, isDefault: true, sheetPosition: 1 },
    ]);
    const r = await setLocationActive(env.deps, ctx, l.value.id, 1, false);
    expect(!r.ok && r.error.code).toBe("LOCATION_IN_USE");
  });

  it("aplica locais sugeridos e edita com trava otimista", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const r = await applySuggestedLocations(env.deps, ctx, ["dry", "frozen", "bar"]);
    expect(r.ok && r.value.created).toBe(3);
    const list = await listLocations(env.deps, ctx);
    expect(list.ok && list.value.map((l) => l.kind)).toEqual(["QUARANTINE", "FROZEN", "DRY", "BAR"]);
    const frozen = list.ok ? list.value.find((l) => l.kind === "FROZEN")! : null;
    expect(frozen?.tempMaxC?.toString()).toBe("-18");
    const upd = await updateLocation(env.deps, ctx, frozen!.id, 1, {
      ...frozen!,
      name: "Freezer horizontal",
    });
    expect(upd.ok).toBe(true);
    const stale = await updateLocation(env.deps, ctx, frozen!.id, 1, { ...frozen!, name: "Outro" });
    expect(!stale.ok && stale.error.code).toBe("STALE_RECORD");
  });

  it("chef não cria local", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const chef = await addMember(env, manager, ["CHEF"]);
    const r = await createLocation(env.deps, chef, camara);
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });
});
