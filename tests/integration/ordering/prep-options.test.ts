import { describe, it, expect } from "vitest";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";
import { orderingScenario, unwrap } from "./fixtures";
import { itemLine } from "../../builders/recipe-data";
import { createRecipe } from "../../../src/application/inventory/recipes";
import { setRecipeSalePrice } from "../../../src/application/inventory/product-costs";
import { createAddon } from "../../../src/application/ordering/addons";
import { setProductCustomization } from "../../../src/application/ordering/customization";
import { orderConsumption } from "../../../src/application/ordering/order-consumption";
import { getMenu } from "../../../src/application/ordering/menu";
import { listKitchenOrders } from "../../../src/application/ordering/kitchen";
import type { Repos } from "../../../src/application/ports";
import { d } from "../../../src/domain/shared/decimal";
import { ok } from "../../../src/domain/shared/result";

/**
 * Spec 018, US3: preparo como opção do pedido (spec 010, US2 e US5). "Lanche da casa" leva pão e
 * 50 g de Molho da casa; o cliente tira o molho e pede 1 "Molho extra" (30 g do mesmo preparo).
 * O molho rende 1 kg com 500 g de cebola e 100 g de bacon.
 */
async function setup() {
  const env = testEnv();
  const m = await newRestaurant(env);
  const s = await orderingScenario(env, m);
  const lanche = unwrap(
    await createRecipe(env.deps, m, {
      name: "Lanche da casa",
      kind: "DISH",
      yieldQuantity: null,
      yieldUnit: null,
      lines: [
        itemLine(s.pao, "1", "un"),
        { component: { kind: "RECIPE", id: s.molho }, quantity: d("50"), unit: "g" },
      ],
    }),
  ).id;
  unwrap(await setRecipeSalePrice(env.deps, m, lanche, 1, d("20.00")));
  const extra = unwrap(
    await createAddon(env.deps, m, {
      name: "Molho extra",
      component: { kind: "RECIPE", id: s.molho },
      quantity: d("30"),
      unit: "g",
      price: d("2.00"),
    }),
  ).id;
  unwrap(
    await setProductCustomization(env.deps, m, {
      recipeId: lanche,
      version: 2,
      addons: [{ addonId: extra, maxTimes: 2 }],
      removables: [{ component: { kind: "RECIPE", id: s.molho } }],
    }),
  );
  return { env, m, s, lanche, extra };
}

describe("preparo como adicional e como retirada (spec 010)", () => {
  it("o cardápio oferece o adicional de preparo ativo e a retirada do preparo", async () => {
    const { env, s, lanche } = await setup();
    const menu = unwrap(await getMenu(env.deps, s.cookie));
    const product = menu.sections.flatMap((x) => x.products).find((p) => p.id === lanche)!;
    expect(product.addons.map((a) => [a.name, a.price, a.maxTimes])).toEqual([["Molho extra", "2.00", 2]]);
    expect(product.removables.map((r) => [r.kind, r.label])).toEqual([["RECIPE", "Sem molho da casa"]]);
  });

  it("sem o molho e com 1 Molho extra: sai só o pão e os 30 g do molho, em cebola e bacon", async () => {
    const { env, m, s, lanche, extra } = await setup();
    const { orderId } = await s.place([
      {
        recipeId: lanche,
        quantity: 1,
        unitPrice: "22.00",
        addons: [{ addonId: extra, times: 1, unitPrice: "2.00" }],
        removals: [{ kind: "RECIPE", id: s.molho }],
      },
    ]);
    const used = unwrap(await orderConsumption(env.deps, m.restaurantId, orderId));
    const view = Object.fromEntries([...used].map(([id, q]) => [id, q.toString()]));
    expect(view).toEqual({ [s.pao]: "1", [s.cebola]: "0.015", [s.bacon]: "0.003" });
    const board = unwrap(await listKitchenOrders(env.deps, m));
    expect(board.orders[0]!.lines[0]!.changes).toEqual(["+ 1 Molho extra", "SEM molho da casa"]);
  });
});

describe("repositórios do pedido: erro do banco que não é repetição sobe como erro", () => {
  it("mesa e adicional com dado que o banco recusa", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const inRepos = (fn: (repos: Repos) => Promise<unknown>) =>
      env.deps.tenant(m.restaurantId, async (repos) => ok(await fn(repos)));
    const at = { at: env.clock.now(), by: m.userId };
    await expect(
      inRepos((r) => r.tables.insert({ id: "x", name: "1", normalized: "1", qrToken: "t" }, at)),
    ).rejects.toThrow();
    await expect(
      inRepos((r) =>
        r.addons.insert(
          {
            id: "x",
            name: "A",
            normalized: "a",
            component: { kind: "ITEM", id: crypto.randomUUID() },
            quantity: d("1"),
            unit: "un",
            price: d("1"),
          },
          at,
        ),
      ),
    ).rejects.toThrow();
    const rows = await ownerTestDb().$client.query("select 1 from dining_tables where restaurant_id = $1", [
      m.restaurantId,
    ]);
    expect(rows.rowCount).toBe(0);
  });
});
