import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { ownerTestDb, testEnv } from "../harness";
import { code, menuLayout, menuScenario, recipeRow, unwrap } from "./fixtures";
import { itemLine } from "../../builders/recipe-data";
import { createMenuProduct } from "../../../src/application/menu/create-product";
import type { MenuProductInput } from "../../../src/application/menu/create-product-input";
import { getRecipe } from "../../../src/application/inventory/recipes";
import { d } from "../../../src/domain/shared/decimal";

/** Produto novo pela tela Cardápio (spec 013, US4). */
type Scenario = Awaited<ReturnType<typeof menuScenario>>;
const suco = (s: Scenario, over: Partial<MenuProductInput> = {}): MenuProductInput => ({
  name: "Suco de laranja",
  lines: [itemLine(s.pao, "1", "un")],
  salePrice: d("9.00"),
  sectionId: s.bebidas,
  description: "  Feito na hora.  ",
  ...over,
});
const count = async (restaurantId: string) => {
  const r = await ownerTestDb().execute<{ recipes: number; audit: number }>(sql`
    select (select count(*)::int from recipes where restaurant_id = ${restaurantId}) as recipes,
           (select count(*)::int from audit_log where restaurant_id = ${restaurantId} and action <> 'DENIED') as audit`);
  return r.rows[0]!;
};
const auditOf = async (id: string) => {
  const r = await ownerTestDb().execute<{ action: string; changes: Record<string, unknown> }>(
    sql`select action, changes from audit_log where entity_id = ${id} order by occurred_at, id`,
  );
  return r.rows;
};

describe("produto novo pela tela Cardápio (spec 013, US4)", () => {
  it("cria o produto vendido com preço, descrição e seção, no fim da seção", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const { id } = unwrap(await createMenuProduct(env.deps, s.chef, suco(s)));
    expect(await recipeRow(id)).toMatchObject({
      sale_price: "9.00",
      description: "Feito na hora.",
      menu_section_id: s.bebidas,
      menu_position: 3,
    });
    expect((await menuLayout(s.m.restaurantId))[1]).toBe("Bebidas: Suco(1), Água(2), Suco de laranja(3)");
    const recipe = unwrap(await getRecipe(env.deps, s.m, id));
    expect(recipe.recipe).toMatchObject({ name: "Suco de laranja", kind: "DISH", active: true });
    expect(recipe.lines).toHaveLength(1);
    expect(
      (await auditOf(id)).map((a) => [a.action, a.changes.event ?? Object.keys(a.changes).sort().join()]),
    ).toEqual([
      ["CREATE", "kind,lines,name,yield"],
      ["UPDATE", "salePrice"],
      ["UPDATE", "menu.details"],
    ]);
    expect((await auditOf(id))[2]!.changes).toEqual({
      event: "menu.details",
      menuDescription: [null, "Feito na hora."],
      menuSection: ["Outros", "Bebidas"],
    });
  });

  it("sem preço, sem seção e sem descrição: fica no fim de Outros com o selo Sem preço", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const { id } = unwrap(
      await createMenuProduct(env.deps, s.m, suco(s, { salePrice: null, sectionId: null, description: "" })),
    );
    expect(await recipeRow(id)).toMatchObject({
      sale_price: null,
      description: null,
      menu_section_id: null,
      menu_position: 2,
      version: 1,
    });
    expect((await auditOf(id)).map((a) => a.action)).toEqual(["CREATE"]);
  });

  it("validações da 003: sem item e nome repetido", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    expect(code(await createMenuProduct(env.deps, s.m, suco(s, { lines: [] })))).toBe("RECIPE_EMPTY");
    expect(code(await createMenuProduct(env.deps, s.m, suco(s, { name: "x-burger" })))).toBe(
      "RECIPE_DUPLICATE_NAME",
    );
  });

  it("erro em qualquer parte não deixa nada gravado", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const before = await count(s.m.restaurantId);
    const cases: [Partial<MenuProductInput>, string][] = [
      [{ salePrice: d("0") }, "INVALID_PRICE"],
      [{ salePrice: d("-1") }, "INVALID_PRICE"],
      [{ description: "a".repeat(301) }, "INVALID_DESCRIPTION"],
      [{ sectionId: "0b0e7a52-5d4c-4d53-9d0c-6a3b0a2f1c11" }, "NOT_FOUND"],
    ];
    for (const [over, expected] of cases) {
      expect(code(await createMenuProduct(env.deps, s.m, suco(s, over))), expected).toBe(expected);
      expect(await count(s.m.restaurantId)).toEqual(before);
    }
    expect(await menuLayout(s.m.restaurantId)).toEqual([
      "Lanches: X-Burger(1), X-Salada(2)",
      "Bebidas: Suco(1), Água(2)",
      "Outros: Batata frita(1)",
    ]);
  });

  it("exige menu.write e recipe.write, e grava a tentativa negada", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    // O estoquista não tem nenhuma das duas.
    expect(code(await createMenuProduct(env.deps, s.stockkeeper, suco(s)))).toBe("FORBIDDEN");
    const denied = await ownerTestDb().execute<{ n: number }>(
      sql`select count(*)::int as n from audit_log
          where restaurant_id = ${s.m.restaurantId} and action = 'DENIED' and user_id = ${s.stockkeeper.userId}`,
    );
    expect(denied.rows[0]!.n).toBe(1);
    expect((await count(s.m.restaurantId)).recipes).toBe(6);
  });

  it("a seção de outro restaurante não existe para este", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const other = await menuScenario(env);
    expect(code(await createMenuProduct(env.deps, s.m, suco(s, { sectionId: other.bebidas })))).toBe(
      "NOT_FOUND",
    );
  });
});
