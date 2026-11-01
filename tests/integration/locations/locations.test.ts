import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, subgroupId, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
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

const geladeira: LocationData = { name: "Geladeira da cozinha", kind: "CHILLED" };

describe("locais (spec 001 US3, simplificado na 002)", () => {
  it("restaurante novo começa sem locais", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const list = await listLocations(env.deps, ctx);
    expect(list.ok && list.value).toEqual([]);
  });

  it("geladeira e freezer salvam só com nome e tipo, sem temperatura", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    expect((await createLocation(env.deps, ctx, geladeira)).ok).toBe(true);
    expect((await createLocation(env.deps, ctx, { name: "Freezer", kind: "FROZEN" })).ok).toBe(true);
  });

  it("nome repetido entre ativos é recusado; inativo libera o nome", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const a = await createLocation(env.deps, ctx, geladeira);
    const dup = await createLocation(env.deps, ctx, { ...geladeira, name: "geladeira da cozinha" });
    expect(!dup.ok && dup.error.code).toBe("NAME_IN_USE");
    if (!a.ok) throw new Error();
    expect((await setLocationActive(env.deps, ctx, a.value.id, 1, false)).ok).toBe(true);
    expect((await createLocation(env.deps, ctx, geladeira)).ok).toBe(true);
  });

  it("não inativa local com itens vinculados", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const l = await createLocation(env.deps, ctx, geladeira);
    const item = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: await subgroupId(env, ctx, "02", "01"), description: "Filé mignon" }),
    );
    if (!l.ok || !item.ok) throw new Error();
    await setItemLocations(env.deps, ctx, item.value.id, [{ locationId: l.value.id, isDefault: true }]);
    const r = await setLocationActive(env.deps, ctx, l.value.id, 1, false);
    expect(!r.ok && r.error.code).toBe("LOCATION_IN_USE");
  });

  it("aplica locais sugeridos (em ordem alfabética) e edita com trava otimista", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const r = await applySuggestedLocations(env.deps, ctx, ["dry", "frozen", "bar"]);
    expect(r.ok && r.value.created).toBe(3);
    const list = await listLocations(env.deps, ctx);
    expect(list.ok && list.value.map((l) => l.name)).toEqual(["Bar", "Despensa seca", "Freezer"]);
    const frozen = list.ok ? list.value.find((l) => l.kind === "FROZEN")! : null;
    const upd = await updateLocation(env.deps, ctx, frozen!.id, 1, {
      name: "Freezer horizontal",
      kind: "FROZEN",
    });
    expect(upd.ok).toBe(true);
    const stale = await updateLocation(env.deps, ctx, frozen!.id, 1, { name: "Outro", kind: "FROZEN" });
    expect(!stale.ok && stale.error.code).toBe("STALE_RECORD");
  });

  it("chef não cria local", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const chef = await addMember(env, manager, ["CHEF"]);
    const r = await createLocation(env.deps, chef, geladeira);
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });
});
