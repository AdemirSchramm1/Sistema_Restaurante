import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv, type TestEnv } from "../harness";
import { code, orderingKitchen, unwrap } from "./fixtures";
import { createAddon, setAddonActive } from "../../../src/application/ordering/addons";
import {
  getProductCustomization,
  setProductCustomization,
} from "../../../src/application/ordering/customization";
import { getRecipe, updateRecipe } from "../../../src/application/inventory/recipes";
import { itemLine } from "../../builders/recipe-data";
import type { RequestContext } from "../../../src/application/context";
import { d } from "../../../src/domain/shared/decimal";

async function setup(env: TestEnv, m: RequestContext) {
  const k = await orderingKitchen(env, m);
  const queijo = unwrap(
    await createAddon(env.deps, m, {
      name: "Fatia de queijo",
      component: { kind: "ITEM", id: k.queijo },
      quantity: d("20"),
      unit: "g",
      price: d("3.00"),
    }),
  ).id;
  const bacon = unwrap(
    await createAddon(env.deps, m, {
      name: "Bacon",
      component: { kind: "ITEM", id: k.bacon },
      quantity: d("30"),
      unit: "g",
      price: d("4.00"),
    }),
  ).id;
  return { ...k, addonQueijo: queijo, addonBacon: bacon };
}

const item = (id: string) => ({ kind: "ITEM" as const, id });

describe("quadro 'Adicionar e tirar' do produto (spec 010, US2)", () => {
  it("liga adicionais e retiradas, com texto padrão 'Sem …', sem criar versão nova", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await setup(env, m);

    const before = unwrap(await getProductCustomization(env.deps, m, k.burger));
    expect(before.version).toBe(2);
    expect(before.addons).toEqual([]);
    expect(before.candidates.map((c) => c.name)).toEqual(["Pão de hambúrguer", "Carne moída", "Queijo prato", "Cebola"]);
    expect(before.available.map((a) => a.name)).toEqual(["Bacon", "Fatia de queijo"]);

    unwrap(
      await setProductCustomization(env.deps, m, {
        recipeId: k.burger,
        version: 2,
        addons: [
          { addonId: k.addonQueijo, maxTimes: 2 },
          { addonId: k.addonBacon, maxTimes: 1 },
        ],
        removables: [{ component: item(k.cebola) }, { component: item(k.queijo), label: "Sem queijo nenhum" }],
      }),
    );
    const after = unwrap(await getProductCustomization(env.deps, m, k.burger));
    expect(after.version).toBe(3);
    expect(after.addons.map((a) => [a.name, a.price.toFixed(2), a.maxTimes])).toEqual([
      ["Fatia de queijo", "3.00", 2],
      ["Bacon", "4.00", 1],
    ]);
    expect(after.removables).toEqual([
      { component: item(k.cebola), label: "Sem cebola", orphan: false },
      { component: item(k.queijo), label: "Sem queijo nenhum", orphan: false },
    ]);
    expect(unwrap(await getRecipe(env.deps, m, k.burger)).versionNumber).toBe(1);

    const audit = await ownerTestDb().$client.query<{ changes: Record<string, [string, string]> }>(
      "select changes from audit_log where entity = 'recipe' and entity_id = $1 and changes ? 'customization'",
      [k.burger],
    );
    expect(audit.rows[0]!.changes.customization).toEqual([
      "Nada para adicionar ou tirar",
      "Adicionar: Fatia de queijo (até 2), Bacon (até 1). Tirar: Sem cebola, Sem queijo nenhum.",
    ]);
  });

  it("troca as listas inteiras e aceita esvaziar", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await setup(env, m);
    unwrap(
      await setProductCustomization(env.deps, m, {
        recipeId: k.burger,
        version: 2,
        addons: [{ addonId: k.addonQueijo, maxTimes: 2 }],
        removables: [{ component: item(k.cebola) }],
      }),
    );
    unwrap(
      await setProductCustomization(env.deps, m, { recipeId: k.burger, version: 3, addons: [], removables: [] }),
    );
    const now = unwrap(await getProductCustomization(env.deps, m, k.burger));
    expect([now.addons, now.removables]).toEqual([[], []]);
  });

  it("retirada fica 'órfã' quando a versão nova do produto tira o ingrediente", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await setup(env, m);
    unwrap(
      await setProductCustomization(env.deps, m, {
        recipeId: k.burger,
        version: 2,
        addons: [],
        removables: [{ component: item(k.cebola) }],
      }),
    );
    unwrap(
      await updateRecipe(env.deps, m, k.burger, 3, {
        name: "X-Burger",
        kind: "DISH",
        yieldQuantity: null,
        yieldUnit: null,
        lines: [itemLine(k.pao, "1", "un"), itemLine(k.carne, "150", "g"), itemLine(k.queijo, "30", "g")],
      }),
    );
    const c = unwrap(await getProductCustomization(env.deps, m, k.burger));
    expect(c.removables).toEqual([{ component: item(k.cebola), label: "Sem cebola", orphan: true }]);
    expect(c.candidates.map((x) => x.name)).not.toContain("Cebola");
  });

  it("recusa o que não pode", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await setup(env, m);
    const set = (over: Partial<Parameters<typeof setProductCustomization>[2]>) =>
      setProductCustomization(env.deps, m, { recipeId: k.burger, version: 2, addons: [], removables: [], ...over });

    expect(code(await set({ addons: [{ addonId: k.addonQueijo, maxTimes: 6 }] }))).toBe("INVALID_MAX_TIMES");
    expect(code(await set({ addons: [{ addonId: k.addonQueijo, maxTimes: 0 }] }))).toBe("INVALID_MAX_TIMES");
    expect(
      code(await set({ addons: [{ addonId: k.addonQueijo, maxTimes: 1 }, { addonId: k.addonQueijo, maxTimes: 2 }] })),
    ).toBe("DUPLICATE_OPTION");
    expect(code(await set({ removables: [{ component: item(k.laranja) }] }))).toBe("NOT_IN_PRODUCT");
    expect(code(await set({ removables: [{ component: item(k.cebola), label: "x".repeat(41) }] }))).toBe(
      "INVALID_LABEL",
    );
    expect(
      code(await set({ removables: Array.from({ length: 11 }, () => ({ component: item(k.cebola) })) })),
    ).toBe("TOO_MANY_OPTIONS");
    expect(code(await set({ addons: [{ addonId: crypto.randomUUID(), maxTimes: 1 }] }))).toBe("ADDON_INACTIVE");
    unwrap(await setAddonActive(env.deps, m, { id: k.addonBacon, active: false, version: 1 }));
    expect(code(await set({ addons: [{ addonId: k.addonBacon, maxTimes: 1 }] }))).toBe("ADDON_INACTIVE");
    expect(code(await set({ version: 1 }))).toBe("STALE_RECORD");
    expect(code(await set({ recipeId: k.molho, version: 1 }))).toBe("NOT_A_DISH");
    expect(code(await getProductCustomization(env.deps, m, k.molho))).toBe("NOT_A_DISH");
    expect(code(await getProductCustomization(env.deps, m, crypto.randomUUID()))).toBe("NOT_FOUND");
  });

  it("chef vê o quadro mas não muda", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await setup(env, m);
    const chef = await addMember(env, m, ["CHEF"]);
    expect(code(await getProductCustomization(env.deps, chef, k.burger))).toBe("OK");
    expect(
      code(
        await setProductCustomization(env.deps, chef, { recipeId: k.burger, version: 2, addons: [], removables: [] }),
      ),
    ).toBe("FORBIDDEN");
  });
});
