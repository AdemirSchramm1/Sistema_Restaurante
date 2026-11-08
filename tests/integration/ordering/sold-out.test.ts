import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, orderingScenario, unwrap } from "./fixtures";
import { listDishesForKitchen, setProductSoldOut } from "../../../src/application/ordering/kitchen";
import { getMenu } from "../../../src/application/ordering/menu";
import { getRecipe } from "../../../src/application/inventory/recipes";

describe("esgotado hoje (spec 009, US5)", () => {
  it("tira do cardápio hoje e volta sozinho amanhã; o produto continua ativo", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const chef = await addMember(env, m, ["CHEF"]);
    unwrap(await setProductSoldOut(env.deps, chef, { recipeId: s.suco, soldOut: true }));
    const row = await ownerTestDb().$client.query("select sold_out_on::text from recipes where id = $1", [
      s.suco,
    ]);
    expect(row.rows[0].sold_out_on).toBe("2026-10-31");
    expect(unwrap(await getMenu(env.deps, s.cookie)).products.map((p) => p.name)).toEqual(["X-Burger"]);
    expect(unwrap(await getRecipe(env.deps, m, s.suco)).recipe.active).toBe(true);
    expect(unwrap(await listDishesForKitchen(env.deps, chef))).toEqual([
      { id: s.suco, name: "Suco", soldOut: true },
      { id: s.burgerId, name: "X-Burger", soldOut: false },
    ]);

    unwrap(await setProductSoldOut(env.deps, chef, { recipeId: s.suco, soldOut: false }));
    expect(unwrap(await getMenu(env.deps, s.cookie)).products).toHaveLength(2);

    unwrap(await setProductSoldOut(env.deps, chef, { recipeId: s.suco, soldOut: true }));
    env.clock.advance(24 * 3600_000);
    expect(unwrap(await listDishesForKitchen(env.deps, chef)).find((x) => x.id === s.suco)?.soldOut).toBe(
      false,
    );
  });

  it("preparo não esgota; garçom não marca; vai para a auditoria", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const waiter = await addMember(env, m, ["WAITER"]);
    expect(code(await setProductSoldOut(env.deps, m, { recipeId: s.molho, soldOut: true }))).toBe(
      "NOT_A_DISH",
    );
    expect(code(await setProductSoldOut(env.deps, m, { recipeId: crypto.randomUUID(), soldOut: true }))).toBe(
      "NOT_FOUND",
    );
    expect(code(await setProductSoldOut(env.deps, waiter, { recipeId: s.suco, soldOut: true }))).toBe(
      "FORBIDDEN",
    );
    unwrap(await setProductSoldOut(env.deps, m, { recipeId: s.suco, soldOut: true }));
    const audit = await ownerTestDb().$client.query(
      "select changes from audit_log where entity = 'recipe' and entity_id = $1 and changes ? 'soldOutOn'",
      [s.suco],
    );
    expect(audit.rows[0].changes).toEqual({ soldOutOn: [null, "2026-10-31"] });
  });
});
