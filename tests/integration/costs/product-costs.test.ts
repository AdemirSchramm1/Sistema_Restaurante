import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testEnv, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { dishData, itemLine, prepData, prepLine } from "../../builders/recipe-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { createRecipe, getRecipe, setRecipeActive } from "../../../src/application/inventory/recipes";
import {
  itemUsage,
  listProductCosts,
  setRecipeSalePrice,
} from "../../../src/application/inventory/product-costs";
import { getAuditHistory } from "../../../src/application/audit/get-audit-history";
import type { RequestContext } from "../../../src/application/context";
import type { RecipeData } from "../../../src/domain/inventory/recipe";
import { d } from "../../../src/domain/shared/decimal";

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

async function setCost(id: string, cost: string) {
  await ownerTestDb().execute(sql`update items set average_cost = ${cost} where id = ${id}`);
}

function withIds(data: RecipeData, ids: Record<string, string>): RecipeData {
  return {
    ...data,
    lines: data.lines.map((l) => ({
      ...l,
      component: { ...l.component, id: ids[l.component.id] ?? l.component.id },
    })),
  };
}

/**
 * Pão R$ 1,00/un, carne R$ 40/kg, queijo R$ 50/kg, tomate R$ 8/kg, cebola R$ 5/kg; alface sem custo.
 * X-Burger (pão 1, carne 150 g, queijo 30 g) = R$ 8,50. Molho de tomate rende 2 kg.
 */
async function kitchen(env: TestEnv, ctx: RequestContext) {
  const sub = await subgroupId(env, ctx, "01", "02");
  const make = async (description: string, stockUnit: "un" | "kg", cost: string | null) => {
    const r = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: sub, description, stockUnit, purchaseUnitLabel: null, purchaseFactor: null }),
    );
    const id = unwrap(r).id;
    if (cost) await setCost(id, cost);
    return id;
  };
  const ids: Record<string, string> = {
    pao: await make("Pão de hambúrguer", "un", "1"),
    carne: await make("Carne moída", "kg", "40"),
    queijo: await make("Queijo prato", "kg", "50"),
    tomate: await make("Tomate", "kg", "8"),
    cebola: await make("Cebola", "kg", "5"),
    alface: await make("Alface", "kg", null),
    sal: await make("Sal", "kg", "2"),
  };
  ids.molho = unwrap(await createRecipe(env.deps, ctx, withIds(prepData(), ids))).id;
  ids.burger = unwrap(await createRecipe(env.deps, ctx, withIds(dishData(), ids))).id;
  return ids;
}

describe("preço de venda do produto (spec 008, US1)", () => {
  it("salva R$ 28,00 no X-Burger, sem criar versão, e registra no histórico", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);

    const r = unwrap(await setRecipeSalePrice(env.deps, ctx, ids.burger!, 1, d("28.00")));
    expect(r.version).toBe(2);
    const view = unwrap(await getRecipe(env.deps, ctx, ids.burger!));
    expect(view.salePrice?.toFixed(2)).toBe("28.00");
    expect(view.versionNumber).toBe(1);

    const history = unwrap(await getAuditHistory(env.deps, ctx, "recipe", ids.burger!));
    const update = history.find((h) => h.action === "UPDATE");
    expect(update?.changes).toEqual({ salePrice: [null, "28.00"] });

    unwrap(await setRecipeSalePrice(env.deps, ctx, ids.burger!, 2, null));
    expect(unwrap(await getRecipe(env.deps, ctx, ids.burger!)).salePrice).toBeNull();
  });

  it("recusa preço inválido, registro desatualizado e preço em preparo", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);
    expect(code(await setRecipeSalePrice(env.deps, ctx, ids.burger!, 1, d(0)))).toBe("INVALID_PRICE");
    expect(code(await setRecipeSalePrice(env.deps, ctx, ids.burger!, 9, d(28)))).toBe("STALE_RECORD");
    expect(code(await setRecipeSalePrice(env.deps, ctx, ids.molho!, 1, d(10)))).toBe("PRICE_ONLY_FOR_DISH");
  });

  it("o banco recusa preço em preparo e preço zero", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);
    const db = ownerTestDb().$client;
    await expect(db.query(`update recipes set sale_price = 10 where id = '${ids.molho}'`)).rejects.toThrow(
      /recipes_sale_price_dish/,
    );
    await expect(db.query(`update recipes set sale_price = 0 where id = '${ids.burger}'`)).rejects.toThrow(
      /recipes_sale_price_positive/,
    );
  });

  it("chef define o preço; estoquista não, e a tentativa fica registrada", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const ids = await kitchen(env, manager);
    const chef = await addMember(env, manager, ["CHEF"]);
    const stockkeeper = await addMember(env, manager, ["STOCKKEEPER"]);
    expect(code(await setRecipeSalePrice(env.deps, chef, ids.burger!, 1, d(28)))).toBe("OK");
    expect(code(await setRecipeSalePrice(env.deps, stockkeeper, ids.burger!, 2, d(30)))).toBe("FORBIDDEN");
    const denied = await ownerTestDb().execute(
      sql`select entity from audit_log where action = 'DENIED' and user_id = ${stockkeeper.userId}`,
    );
    expect(denied.rows).toEqual([{ entity: "recipe" }]);
  });
});

describe("painel de custo dos produtos (spec 008, US2)", () => {
  it("mostra custo, custo no preço, faixa, sobra e o que mais pesa, na ordem do painel", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);
    unwrap(await setRecipeSalePrice(env.deps, ctx, ids.burger!, 1, d("28.00")));

    // Bruschetta: 100 g de molho (R$ 1,05) + 10 g de sal (R$ 0,02) a R$ 2,50 → 42,8%, alto.
    const bruschetta = unwrap(
      await createRecipe(
        env.deps,
        ctx,
        withIds(
          dishData({
            name: "Bruschetta",
            lines: [prepLine("molho", "100", "g"), itemLine("sal", "10", "g")],
          }),
          ids,
        ),
      ),
    );
    unwrap(await setRecipeSalePrice(env.deps, ctx, bruschetta.id, 1, d("2.50")));
    // Salada: alface sem custo.
    unwrap(
      await createRecipe(
        env.deps,
        ctx,
        withIds(dishData({ name: "Salada", lines: [itemLine("alface", "80", "g")] }), ids),
      ),
    );
    // Cebola frita: sem preço.
    unwrap(
      await createRecipe(
        env.deps,
        ctx,
        withIds(dishData({ name: "Cebola frita", lines: [itemLine("cebola", "200", "g")] }), ids),
      ),
    );
    // Inativo não aparece.
    const old = unwrap(
      await createRecipe(
        env.deps,
        ctx,
        withIds(dishData({ name: "Antigo", lines: [itemLine("sal", "1", "g")] }), ids),
      ),
    );
    unwrap(await setRecipeActive(env.deps, ctx, old.id, 1, false));

    const panel = unwrap(await listProductCosts(env.deps, ctx));
    expect(panel.rows.map((r) => r.name)).toEqual(["Bruschetta", "X-Burger", "Cebola frita", "Salada"]);

    const [b, x, cebola, salada] = panel.rows;
    expect(b!.cost?.toString()).toBe("1.07");
    expect(b!.share?.toFixed(1)).toBe("42.8");
    expect(b!.band).toBe("HIGH");
    expect(b!.heaviest?.name).toBe("Molho de tomate");

    expect(x!.cost?.toString()).toBe("8.5");
    expect(x!.share?.toFixed(1)).toBe("30.4");
    expect(x!.band).toBe("OK");
    expect(x!.margin?.toFixed(2)).toBe("19.50");
    expect(x!.heaviest?.name).toBe("Carne moída");
    expect(x!.heaviest?.share.toFixed(0)).toBe("71");

    expect(cebola!.cost?.toString()).toBe("1");
    expect(cebola!.salePrice).toBeNull();
    expect(salada!.cost).toBeNull();
    expect(salada!.missingCostNames).toEqual(["Alface"]);

    expect(panel.summary).toEqual({ total: 4, high: 1, warn: 0, ok: 1, noPrice: 1, noCost: 1 });
  });

  it("o custo acompanha o custo médio atual do item", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);
    unwrap(await setRecipeSalePrice(env.deps, ctx, ids.burger!, 1, d("20.00")));
    await setCost(ids.carne!, "60"); // 150 g → R$ 9,00; total R$ 11,50 = 57,5%
    const [x] = unwrap(await listProductCosts(env.deps, ctx)).rows;
    expect(x!.cost?.toString()).toBe("11.5");
    expect(x!.share?.toString()).toBe("57.5");
  });

  it("restaurante B não vê os produtos de A", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    const ids = await kitchen(env, a);
    expect(unwrap(await listProductCosts(env.deps, a)).rows).toHaveLength(1);
    expect(unwrap(await listProductCosts(env.deps, b)).rows).toEqual([]);
    expect(unwrap(await itemUsage(env.deps, b, ids.carne!))).toEqual([]);
  });
});

describe("em quais produtos o item entra (spec 008, US3)", () => {
  it("lista os produtos ativos que usam o item direto ou dentro de um preparo", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const ids = await kitchen(env, ctx);
    unwrap(await setRecipeSalePrice(env.deps, ctx, ids.burger!, 1, d("28.00")));
    const pizza = unwrap(
      await createRecipe(
        env.deps,
        ctx,
        withIds(
          dishData({ name: "Pizza", lines: [prepLine("molho", "150", "g"), itemLine("queijo", "200", "g")] }),
          ids,
        ),
      ),
    );

    const queijo = unwrap(await itemUsage(env.deps, ctx, ids.queijo!));
    expect(queijo.map((u) => [u.name, u.kind, u.cost?.toString(), u.share?.toFixed(1) ?? null])).toEqual([
      ["Pizza", "DISH", "11.575", null],
      ["X-Burger", "DISH", "8.5", "30.4"],
    ]);

    const tomate = unwrap(await itemUsage(env.deps, ctx, ids.tomate!));
    expect(tomate.map((u) => [u.id, u.kind])).toEqual([
      [ids.molho, "SUB_RECIPE"],
      [pizza.id, "DISH"],
    ]);

    expect(unwrap(await itemUsage(env.deps, ctx, ids.alface!))).toEqual([]);
  });
});
