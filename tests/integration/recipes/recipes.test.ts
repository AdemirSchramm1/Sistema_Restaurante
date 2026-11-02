import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testDb, testEnv, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { dishData, itemLine, prepData, prepLine } from "../../builders/recipe-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { setItemActive } from "../../../src/application/inventory/set-item-active";
import {
  createRecipe,
  getRecipe,
  getRecipeVersionAt,
  listRecipes,
  recipeFormOptions,
  setRecipeActive,
  updateRecipe,
} from "../../../src/application/inventory/recipes";
import { getAuditHistory } from "../../../src/application/audit/get-audit-history";
import type { RequestContext } from "../../../src/application/context";
import type { RecipeData } from "../../../src/domain/inventory/recipe";
import { withTenantTx } from "../../../src/infra/db/db";
import { d } from "../../../src/domain/shared/decimal";

type Ids = Record<"pao" | "carne" | "queijo" | "tomate" | "cebola", string>;

/** Restaurante com pão (un), carne, queijo, tomate e cebola (kg). */
async function kitchen(env: TestEnv, ctx: RequestContext): Promise<Ids> {
  const sub = await subgroupId(env, ctx, "01", "02");
  const make = async (description: string, stockUnit: "un" | "kg") => {
    const r = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: sub, description, stockUnit, purchaseUnitLabel: null, purchaseFactor: null }),
    );
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    return r.value.id;
  };
  return {
    pao: await make("Pão de hambúrguer", "un"),
    carne: await make("Carne moída", "kg"),
    queijo: await make("Queijo prato", "kg"),
    tomate: await make("Tomate", "kg"),
    cebola: await make("Cebola", "kg"),
  };
}

/** Troca os ids "pao", "carne"… dos builders pelos do banco. */
function withIds(data: RecipeData, ids: Record<string, string>): RecipeData {
  return {
    ...data,
    lines: data.lines.map((l) => ({
      ...l,
      component: { ...l.component, id: ids[l.component.id] ?? l.component.id },
    })),
  };
}

async function setCost(id: string, cost: string) {
  await ownerTestDb().execute(sql`update items set average_cost = ${cost} where id = ${id}`);
}

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

describe("cadastrar produto (spec 003, US1)", () => {
  it("salva o X-Burger com três linhas e mostra 'sem custo' até haver custo médio", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);
    const { id } = unwrap(await createRecipe(env.deps, ctx, withIds(dishData(), ids)));

    const view = unwrap(await getRecipe(env.deps, ctx, id));
    expect(view.recipe.name).toBe("X-Burger");
    expect(view.recipe.kind).toBe("DISH");
    expect(view.versionNumber).toBe(1);
    expect(view.lines.map((l) => [l.name, l.quantity.toString(), l.unit])).toEqual([
      ["Pão de hambúrguer", "1", "un"],
      ["Carne moída", "150", "g"],
      ["Queijo prato", "30", "g"],
    ]);
    expect(view.total).toBeNull();
    expect(view.missingCostNames.sort()).toEqual(["Carne moída", "Pão de hambúrguer", "Queijo prato"]);

    await setCost(ids.pao, "1.2");
    await setCost(ids.carne, "40");
    await setCost(ids.queijo, "50");
    const priced = unwrap(await getRecipe(env.deps, ctx, id));
    expect(priced.lines.map((l) => l.cost?.toString())).toEqual(["1.2", "6", "1.5"]);
    expect(priced.total?.toString()).toBe("8.7");

    const list = unwrap(await listRecipes(env.deps, ctx, { q: "burger" }));
    expect(list.map((r) => [r.name, r.lineCount, r.active])).toEqual([["X-Burger", 3, true]]);
  });

  it("recusa nome repetido entre ativos, sem diferenciar maiúsculas e acentos", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);
    const first = unwrap(await createRecipe(env.deps, ctx, withIds(dishData({ name: "Pão na chapa" }), ids)));
    const dup = await createRecipe(env.deps, ctx, withIds(dishData({ name: "PAO NA  CHAPA" }), ids));
    expect(code(dup)).toBe("RECIPE_DUPLICATE_NAME");

    unwrap(await setRecipeActive(env.deps, ctx, first.id, 1, false));
    expect(code(await createRecipe(env.deps, ctx, withIds(dishData({ name: "PAO NA  CHAPA" }), ids)))).toBe(
      "OK",
    );
  });

  it("item inativo não entra em produto novo", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);
    unwrap(await setItemActive(env.deps, ctx, ids.queijo, 1, false));
    const r = await createRecipe(env.deps, ctx, withIds(dishData(), ids));
    expect(code(r)).toBe("COMPONENT_INACTIVE");
    if (!r.ok) expect(r.error.field).toBe("lines.2.component");

    const options = unwrap(await recipeFormOptions(env.deps, ctx));
    expect(options.items.map((i) => i.label)).not.toContain("Queijo prato");
  });
});

describe("editar produto e versões (spec 003, US2, FR-004)", () => {
  it("editar as linhas cria a versão 2; o pedido de antes continua vendo a versão 1", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);
    const { id } = unwrap(await createRecipe(env.deps, ctx, withIds(dishData(), ids)));
    const before = env.clock.now();
    env.clock.advance(60_000);

    const more = withIds(
      dishData({ lines: [itemLine("pao", "1", "un"), itemLine("carne", "200", "g")] }),
      ids,
    );
    const upd = unwrap(await updateRecipe(env.deps, ctx, id, 1, more));
    expect(upd.versionNumber).toBe(2);

    const v1 = unwrap(await getRecipeVersionAt(env.deps, ctx, id, before));
    const v2 = unwrap(await getRecipeVersionAt(env.deps, ctx, id, env.clock.now()));
    expect(v1?.number).toBe(1);
    expect(v1?.lines).toHaveLength(3);
    expect(v2?.number).toBe(2);
    expect(v2?.lines.map((l) => l.quantity.toString())).toEqual(["1", "200"]);
  });

  it("mudar só o nome não cria versão; registro desatualizado dá STALE_RECORD", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);
    const { id } = unwrap(await createRecipe(env.deps, ctx, withIds(dishData(), ids)));
    const r = unwrap(
      await updateRecipe(env.deps, ctx, id, 1, withIds(dishData({ name: "X-Burger da casa" }), ids)),
    );
    expect(r.versionNumber).toBeNull();
    expect(unwrap(await getRecipe(env.deps, ctx, id)).versionNumber).toBe(1);
    expect(code(await updateRecipe(env.deps, ctx, id, 1, withIds(dishData(), ids)))).toBe("STALE_RECORD");
  });

  it("guarda o histórico de criar e editar", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);
    const { id } = unwrap(await createRecipe(env.deps, ctx, withIds(dishData(), ids)));
    unwrap(
      await updateRecipe(
        env.deps,
        ctx,
        id,
        1,
        withIds(dishData({ lines: [itemLine("pao", "2", "un")] }), ids),
      ),
    );
    const history = unwrap(await getAuditHistory(env.deps, ctx, "recipe", id));
    expect(history.map((h) => h.action).sort()).toEqual(["CREATE", "UPDATE"]);
    const update = history.find((h) => h.action === "UPDATE")!;
    expect(update.changes).toEqual({
      lines: ["Pão de hambúrguer: 1 un; Carne moída: 150 g; Queijo prato: 30 g", "Pão de hambúrguer: 2 un"],
    });
  });

  it("versões e linhas gravadas não mudam nem somem", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);
    unwrap(await createRecipe(env.deps, ctx, withIds(dishData(), ids)));
    for (const stmt of [
      "update recipe_lines set quantity = 2",
      "delete from recipe_lines",
      "update recipe_versions set number = 9",
      "delete from recipe_versions",
    ]) {
      await expect(
        withTenantTx(testDb(), ctx.restaurantId, (tx) => tx.execute(sql.raw(stmt))),
        stmt,
      ).rejects.toThrow();
      await expect(ownerTestDb().$client.query(stmt), `${stmt} (dono)`).rejects.toThrow(/APPEND_ONLY/);
    }
  });
});

describe("preparos (spec 003, US4)", () => {
  async function setup() {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);
    const molho = unwrap(await createRecipe(env.deps, ctx, withIds(prepData(), ids)));
    const all = { ...ids, molho: molho.id };
    const lines = [itemLine("pao", "1", "un"), prepLine("molho", "50", "g")];
    const burger = unwrap(await createRecipe(env.deps, ctx, withIds(dishData({ lines }), all)));
    return { env, ctx, ids: all, burger: burger.id };
  }

  it("o X-Burger usa 50 g do molho que rende 2 kg e custa a parte proporcional", async () => {
    const { env, ctx, ids, burger } = await setup();
    await setCost(ids.pao, "1");
    await setCost(ids.tomate, "8");
    await setCost(ids.cebola, "5");
    const view = unwrap(await getRecipe(env.deps, ctx, burger));
    expect(view.lines.map((l) => [l.name, l.componentKind, l.cost?.toString()])).toEqual([
      ["Pão de hambúrguer", "ITEM", "1"],
      ["Molho de tomate", "RECIPE", "0.525"],
    ]);
    expect(view.total?.toString()).toBe("1.525");

    const molho = unwrap(await getRecipe(env.deps, ctx, ids.molho));
    expect(molho.recipe.yieldQuantity?.toString()).toBe("2");
    expect(molho.costPerYieldUnit?.toString()).toBe("10.5");
    expect(molho.usedBy).toEqual(["X-Burger"]);

    const options = unwrap(await recipeFormOptions(env.deps, ctx));
    expect(options.preps.map((p) => [p.label, p.unit])).toEqual([["Molho de tomate", "kg"]]);
  });

  it("preparo em uso não é inativado, não vira vendido e não troca kg por un", async () => {
    const { env, ctx, ids } = await setup();
    const off = await setRecipeActive(env.deps, ctx, ids.molho, 1, false);
    expect(code(off)).toBe("RECIPE_IN_USE");
    if (!off.ok) expect(off.error.details).toEqual({ usedBy: ["X-Burger"] });

    const dish = withIds(prepData({ kind: "DISH", yieldQuantity: null, yieldUnit: null }), ids);
    expect(code(await updateRecipe(env.deps, ctx, ids.molho, 1, dish))).toBe("RECIPE_IN_USE");
    const un = withIds(prepData({ yieldUnit: "un" }), ids);
    expect(code(await updateRecipe(env.deps, ctx, ids.molho, 1, un))).toBe("RECIPE_IN_USE");
    const grams = withIds(prepData({ yieldUnit: "g", yieldQuantity: d("2000") }), ids);
    expect(code(await updateRecipe(env.deps, ctx, ids.molho, 1, grams))).toBe("OK");
  });

  it("produto vendido não entra em outro; preparo não fecha ciclo", async () => {
    const { env, ctx, ids, burger } = await setup();
    const inside = withIds(dishData({ name: "Combo", lines: [prepLine("burger", "1", "un")] }), {
      ...ids,
      burger,
    });
    expect(code(await createRecipe(env.deps, ctx, inside))).toBe("NOT_A_SUB_RECIPE");

    const base = unwrap(
      await createRecipe(
        env.deps,
        ctx,
        withIds(prepData({ name: "Base", lines: [prepLine("molho", "1", "kg")] }), ids),
      ),
    );
    const loop = withIds(prepData({ lines: [itemLine("tomate", "1", "kg"), prepLine("base", "1", "kg")] }), {
      ...ids,
      base: base.id,
    });
    const r = await updateRecipe(env.deps, ctx, ids.molho, 1, loop);
    expect(code(r)).toBe("RECIPE_CYCLE");
  });
});

describe("segurança (FR-006, FR-007)", () => {
  it("chef cadastra produto; estoquista não, e a tentativa fica registrada", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const ids = await kitchen(env, manager);
    const chef = await addMember(env, manager, ["CHEF"]);
    const stockkeeper = await addMember(env, manager, ["STOCKKEEPER"]);
    expect(code(await createRecipe(env.deps, chef, withIds(dishData(), ids)))).toBe("OK");
    expect(code(await createRecipe(env.deps, stockkeeper, withIds(dishData({ name: "Outro" }), ids)))).toBe(
      "FORBIDDEN",
    );
    const denied = await ownerTestDb().execute(
      sql`select entity from audit_log where action = 'DENIED' and user_id = ${stockkeeper.userId}`,
    );
    expect(denied.rows).toEqual([{ entity: "recipe" }]);
    expect(unwrap(await listRecipes(env.deps, stockkeeper, {}))).toHaveLength(1);
  });

  it("restaurante B não vê o produto de A nem usa os itens de A", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    const ids = await kitchen(env, a);
    const { id } = unwrap(await createRecipe(env.deps, a, withIds(dishData(), ids)));
    expect(code(await getRecipe(env.deps, b, id))).toBe("NOT_FOUND");
    expect(unwrap(await listRecipes(env.deps, b, {}))).toEqual([]);
    const r = await createRecipe(env.deps, b, withIds(dishData(), ids));
    expect(code(r)).toBe("NOT_FOUND");
  });
});
