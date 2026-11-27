import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testEnv, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { dishData, prepData } from "../../builders/recipe-data";
import { createItem } from "../../../src/application/inventory/create-item";
import {
  createRecipe,
  getRecipe,
  getRecipeVersionAt,
  listRecipes,
  recipeFormOptions,
  setRecipeActive,
  updateRecipe,
} from "../../../src/application/inventory/recipes";
import {
  itemUsage,
  listProductCosts,
  setRecipeSalePrice,
} from "../../../src/application/inventory/product-costs";
import type { RecipeData } from "../../../src/domain/inventory/recipe";
import { d } from "../../../src/domain/shared/decimal";
import type { Result } from "../../../src/domain/shared/result";

/** Spec 018, US2: recusas das fichas técnicas e do custo do produto (docs/produto/estoque/04) que faltavam. */

const db = () => ownerTestDb().$client;
const code = (r: Result<unknown>) => (r.ok ? "OK" : r.error.code);
const fail = (r: Result<unknown>) => (r.ok ? "OK" : `${r.error.code}@${r.error.field ?? ""}`);
const value = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
};
const auditActions = async (id: string) =>
  (
    await db().query(
      "select action from audit_log where entity_id = $1 and action <> 'DENIED' order by occurred_at, id",
      [id],
    )
  ).rows.map((r) => r.action as string);

async function setup(env: TestEnv) {
  const m = await newRestaurant(env);
  const stockkeeper = await addMember(env, m, ["STOCKKEEPER"]);
  const waiter = await addMember(env, m, ["WAITER"]);
  const sub = await subgroupId(env, m, "01", "02");
  const make = async (description: string, stockUnit: "un" | "kg") =>
    value(
      await createItem(
        env.deps,
        m,
        itemData({ subgroupId: sub, description, stockUnit, purchaseUnitLabel: null, purchaseFactor: null }),
      ),
    ).id;
  const ids: Record<string, string> = {
    pao: await make("Pão de hambúrguer", "un"),
    carne: await make("Carne moída", "kg"),
    queijo: await make("Queijo prato", "kg"),
    tomate: await make("Tomate", "kg"),
    cebola: await make("Cebola", "kg"),
  };
  const withIds = (data: RecipeData): RecipeData => ({
    ...data,
    lines: data.lines.map((l) => ({
      ...l,
      component: { ...l.component, id: ids[l.component.id] ?? l.component.id },
    })),
  });
  const burger = value(await createRecipe(env.deps, m, withIds(dishData()))).id;
  return { m, stockkeeper, waiter, ids, withIds, burger };
}

describe("fichas técnicas: recusas e casos (spec 003)", () => {
  it("estoquista não edita nem inativa; garçom não vê lista, ficha, versão, opções nem custo", async () => {
    const env = testEnv();
    const t = await setup(env);
    const dish = t.withIds(dishData());
    expect(code(await updateRecipe(env.deps, t.stockkeeper, t.burger, 1, dish))).toBe("FORBIDDEN");
    expect(code(await setRecipeActive(env.deps, t.stockkeeper, t.burger, 1, false))).toBe("FORBIDDEN");
    expect(code(await listRecipes(env.deps, t.waiter, {}))).toBe("FORBIDDEN");
    expect(code(await getRecipe(env.deps, t.waiter, t.burger))).toBe("FORBIDDEN");
    expect(code(await getRecipeVersionAt(env.deps, t.waiter, t.burger, env.clock.now()))).toBe("FORBIDDEN");
    expect(code(await recipeFormOptions(env.deps, t.waiter))).toBe("FORBIDDEN");
    expect(code(await listProductCosts(env.deps, t.waiter))).toBe("FORBIDDEN");
    expect(code(await itemUsage(env.deps, t.waiter, t.ids.pao!))).toBe("FORBIDDEN");
  });

  it("produto que não existe: editar, inativar e pôr preço dizem NOT_FOUND", async () => {
    const env = testEnv();
    const t = await setup(env);
    const missing = crypto.randomUUID();
    expect(code(await updateRecipe(env.deps, t.m, missing, 1, t.withIds(dishData())))).toBe("NOT_FOUND");
    expect(code(await setRecipeActive(env.deps, t.m, missing, 1, false))).toBe("NOT_FOUND");
    expect(code(await setRecipeSalePrice(env.deps, t.m, missing, 1, d("30.00")))).toBe("NOT_FOUND");
  });

  it("renomear para o nome de outro ativo é recusado pelo banco no campo name", async () => {
    const env = testEnv();
    const t = await setup(env);
    value(await createRecipe(env.deps, t.m, t.withIds(dishData({ name: "X-Salada" }))));
    expect(
      fail(await updateRecipe(env.deps, t.m, t.burger, 1, t.withIds(dishData({ name: "x-SALADA" })))),
    ).toBe("RECIPE_DUPLICATE_NAME@name");
  });

  it("salvar sem mudar nada soma a versão do registro e não escreve no histórico", async () => {
    const env = testEnv();
    const t = await setup(env);
    expect(value(await updateRecipe(env.deps, t.m, t.burger, 1, t.withIds(dishData())))).toEqual({
      version: 2,
      versionNumber: null,
    });
    expect(await auditActions(t.burger)).toEqual(["CREATE"]);
  });

  it("produto vendido inativa e volta sem olhar preparos; versão velha é recusada", async () => {
    const env = testEnv();
    const t = await setup(env);
    expect(code(await setRecipeActive(env.deps, t.m, t.burger, 9, false))).toBe("STALE_RECORD");
    value(await setRecipeActive(env.deps, t.m, t.burger, 1, false));
    value(await setRecipeActive(env.deps, t.m, t.burger, 2, true));
    expect(await auditActions(t.burger)).toEqual(["CREATE", "DEACTIVATE", "REACTIVATE"]);
  });

  it("lista por tipo e por nome; versão numa data antes de existir é nenhuma", async () => {
    const env = testEnv();
    const t = await setup(env);
    const prep = value(await createRecipe(env.deps, t.m, t.withIds(prepData()))).id;
    const names = async (f: Parameters<typeof listRecipes>[2]) =>
      value(await listRecipes(env.deps, t.m, f)).map((r) => r.name);
    expect(await names({ kind: "SUB_RECIPE" })).toEqual(["Molho de tomate"]);
    expect(await names({ q: "burg" })).toEqual(["X-Burger"]);
    expect(await names({ q: "100%" })).toEqual([]);
    expect(value(await getRecipeVersionAt(env.deps, t.m, prep, new Date(0)))).toBeNull();
  });
});

describe("preço de venda (spec 008)", () => {
  it("o mesmo preço de novo soma a versão e não vai para o histórico", async () => {
    const env = testEnv();
    const t = await setup(env);
    value(await setRecipeSalePrice(env.deps, t.m, t.burger, 1, d("30.00")));
    value(await setRecipeSalePrice(env.deps, t.m, t.burger, 2, d("30.00")));
    const prices = await db().query(
      "select count(*)::int as n from audit_log where entity_id = $1 and changes ? 'salePrice'",
      [t.burger],
    );
    expect(prices.rows[0].n).toBe(1);
  });
});
