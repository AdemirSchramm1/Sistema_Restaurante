import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, subgroupId, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { listGroupTree } from "../../../src/application/inventory/list-group-tree";
import {
  createGroup,
  createSubgroup,
  renameGroup,
  renameSubgroup,
  setGroupActive,
  setSubgroupActive,
} from "../../../src/application/inventory/groups";

describe("grupos e subgrupos (spec 001, US2)", () => {
  it("restaurante novo já tem a árvore padrão (cenário 2.1)", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const tree = await listGroupTree(env.deps, ctx);
    expect(tree.ok && tree.value.map((g) => g.code)).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
      "13",
    ]);
    expect(tree.ok && tree.value.every((g) => g.isSystem)).toBe(true);
  });

  it("cria o subgrupo Cogumelos em Hortifrúti com o próximo código livre (cenário 2.3)", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const tree = await listGroupTree(env.deps, ctx);
    const flv = tree.ok ? tree.value[0]! : null;
    const r = await createSubgroup(env.deps, ctx, { groupId: flv!.id, name: "Cogumelos" });
    expect(r.ok && r.value.code).toBe("05");
    const again = await createSubgroup(env.deps, ctx, { groupId: flv!.id, name: "Brotos" });
    expect(again.ok && again.value.code).toBe("06");
  });

  it("cria grupo novo com código 14 e recusa nome repetido entre ativos", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const r = await createGroup(env.deps, ctx, {
      name: "Gás",
      storageClass: "OTHER_NON_FOOD",
      inCogs: false,
    });
    expect(r.ok && r.value.code).toBe("14");
    const dup = await createGroup(env.deps, ctx, {
      name: "gás",
      storageClass: "OTHER_NON_FOOD",
      inCogs: false,
    });
    expect(!dup.ok && dup.error.code).toBe("NAME_IN_USE");
    const dupSub = await createSubgroup(env.deps, ctx, { groupId: r.ok ? r.value.id : "", name: "Botijões" });
    expect(dupSub.ok).toBe(true);
    const dupSub2 = await createSubgroup(env.deps, ctx, {
      groupId: r.ok ? r.value.id : "",
      name: "BOTIJÕES",
    });
    expect(!dupSub2.ok && dupSub2.error.code).toBe("NAME_IN_USE");
  });

  it("não inativa grupo padrão (cenário 2.2)", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const tree = await listGroupTree(env.deps, ctx);
    const bebidas = tree.ok ? tree.value.find((g) => g.name === "Bebidas")! : null;
    const r = await setGroupActive(env.deps, ctx, bebidas!.id, bebidas!.version, false);
    expect(!r.ok && r.error.code).toBe("SYSTEM_RECORD");
  });

  it("inativa grupo criado pelo restaurante só sem itens ativos", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const g = await createGroup(env.deps, ctx, {
      name: "Gás",
      storageClass: "OTHER_NON_FOOD",
      inCogs: false,
    });
    if (!g.ok) throw new Error();
    const s = await createSubgroup(env.deps, ctx, { groupId: g.value.id, name: "Botijões" });
    if (!s.ok) throw new Error();
    const item = await createItem(
      env.deps,
      ctx,
      itemData({
        subgroupId: s.value.id,
        description: "Botijão P13",
        type: "CONSUMABLE",
        stockUnit: "un",
        purchaseUnitLabel: "Botijão",
        purchaseFactor: (await import("../../../src/domain/shared/decimal")).d(1),
      }),
    );
    expect(item.ok ? "ok" : item.error).toBe("ok");
    const blocked = await setGroupActive(env.deps, ctx, g.value.id, 1, false);
    expect(!blocked.ok && blocked.error.code).toBe("SUBGROUP_HAS_ACTIVE_ITEMS");
  });

  it("não inativa subgrupo com itens ativos (cenário 2.5)", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const sub = await subgroupId(env, ctx, "01", "02");
    expect((await createItem(env.deps, ctx, itemData({ subgroupId: sub }))).ok).toBe(true);
    const r = await setSubgroupActive(env.deps, ctx, sub, 1, false);
    expect(!r.ok && r.error.code).toBe("SUBGROUP_HAS_ACTIVE_ITEMS");
    const empty = await subgroupId(env, ctx, "01", "04");
    expect((await setSubgroupActive(env.deps, ctx, empty, 1, false)).ok).toBe(true);
  });

  it("renomear mantém o código", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const sub = await subgroupId(env, ctx, "01", "02");
    expect((await renameSubgroup(env.deps, ctx, sub, 1, "Legumes e raízes")).ok).toBe(true);
    const tree = await listGroupTree(env.deps, ctx);
    const s = tree.ok ? tree.value[0]!.subgroups.find((x) => x.id === sub)! : null;
    expect(s).toMatchObject({ code: "02", name: "Legumes e raízes" });
    const g = tree.ok ? tree.value[0]! : null;
    expect((await renameGroup(env.deps, ctx, g!.id, g!.version, "Hortifrúti")).ok).toBe(true);
  });

  it("chef não mexe em grupos", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const chef = await addMember(env, manager, ["CHEF"]);
    const tree = await listGroupTree(env.deps, chef);
    const r = await createSubgroup(env.deps, chef, {
      groupId: tree.ok ? tree.value[0]!.id : "",
      name: "Cogumelos",
    });
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });
});
