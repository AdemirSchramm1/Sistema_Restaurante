import { sql } from "drizzle-orm";
import { ownerTestDb, subgroupId, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { itemLine } from "../../builders/recipe-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { createRecipe } from "../../../src/application/inventory/recipes";
import { setRecipeSalePrice } from "../../../src/application/inventory/product-costs";
import type { RequestContext } from "../../../src/application/context";
import { d } from "../../../src/domain/shared/decimal";

export const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
export const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

/**
 * Cozinha dos testes de pedidos (specs 009 e 010): pão R$ 1,00/un, carne R$ 40/kg, queijo R$ 50/kg,
 * cebola R$ 5/kg, bacon R$ 60/kg, laranja R$ 4/kg. X-Burger (pão 1, carne 150 g, queijo 30 g,
 * cebola 20 g) a R$ 28,00; Suco (laranja 300 g) a R$ 9,00; Molho da casa (preparo, rende 1 kg).
 */
export async function orderingKitchen(env: TestEnv, ctx: RequestContext) {
  const sub = await subgroupId(env, ctx, "01", "02");
  const make = async (description: string, stockUnit: "un" | "kg", cost: string) => {
    const id = unwrap(
      await createItem(
        env.deps,
        ctx,
        itemData({ subgroupId: sub, description, stockUnit, purchaseUnitLabel: null, purchaseFactor: null }),
      ),
    ).id;
    await ownerTestDb().execute(sql`update items set average_cost = ${cost} where id = ${id}`);
    return id;
  };
  const pao = await make("Pão de hambúrguer", "un", "1");
  const carne = await make("Carne moída", "kg", "40");
  const queijo = await make("Queijo prato", "kg", "50");
  const cebola = await make("Cebola", "kg", "5");
  const bacon = await make("Bacon", "kg", "60");
  const laranja = await make("Laranja", "kg", "4");
  const molho = unwrap(
    await createRecipe(env.deps, ctx, {
      name: "Molho da casa",
      kind: "SUB_RECIPE",
      yieldQuantity: d("1"),
      yieldUnit: "kg",
      lines: [itemLine(cebola, "500", "g"), itemLine(bacon, "100", "g")],
    }),
  ).id;
  const burger = unwrap(
    await createRecipe(env.deps, ctx, {
      name: "X-Burger",
      kind: "DISH",
      yieldQuantity: null,
      yieldUnit: null,
      lines: [itemLine(pao, "1", "un"), itemLine(carne, "150", "g"), itemLine(queijo, "30", "g"), itemLine(cebola, "20", "g")],
    }),
  ).id;
  const suco = unwrap(
    await createRecipe(env.deps, ctx, {
      name: "Suco",
      kind: "DISH",
      yieldQuantity: null,
      yieldUnit: null,
      lines: [itemLine(laranja, "300", "g")],
    }),
  ).id;
  unwrap(await setRecipeSalePrice(env.deps, ctx, burger, 1, d("28.00")));
  unwrap(await setRecipeSalePrice(env.deps, ctx, suco, 1, d("9.00")));
  return { pao, carne, queijo, cebola, bacon, laranja, molho, burger, suco };
}
