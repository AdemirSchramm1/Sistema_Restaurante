import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { ownerTestDb, testEnv } from "../harness";
import { code, menuKitchen, menuLayout, menuScenario, recipeRow, unwrap } from "./fixtures";
import { scan, tableWithQr } from "../ordering/fixtures";
import { moveProduct } from "../../../src/application/menu/order";
import { createRecipe, getRecipe, updateRecipe } from "../../../src/application/inventory/recipes";
import { submitOrder } from "../../../src/application/ordering/submit-order";
import { itemLine } from "../../builders/recipe-data";
import { d } from "../../../src/domain/shared/decimal";

/** Ordem dos produtos no cardápio (spec 013, US3). */
const moves = async (restaurantId: string) => {
  const r = await ownerTestDb().execute<{
    action: string;
    changes: Record<string, unknown>;
    user_id: string;
  }>(
    sql`select action, changes, user_id from audit_log
        where restaurant_id = ${restaurantId} and changes->>'event' = 'menu.product.move'
        order by occurred_at, id`,
  );
  return r.rows;
};

describe("ordem dos produtos (spec 013, US3)", () => {
  it("sobe e desce trocando com o vizinho da mesma seção, mantendo 1..n", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const go = async (id: string, direction: "up" | "down") =>
      code(await moveProduct(env.deps, s.chef, { id, direction }));
    expect(await go(s.salada, "up")).toBe("OK");
    expect(await menuLayout(s.m.restaurantId)).toEqual([
      "Lanches: X-Salada(1), X-Burger(2)",
      "Bebidas: Suco(1), Água(2)",
      "Outros: Batata frita(1)",
    ]);
    expect(await go(s.salada, "down")).toBe("OK");
    expect(await go(s.burger, "up")).toBe("NO_CHANGE");
    expect(await go(s.salada, "down")).toBe("NO_CHANGE");
    expect(await go(s.batata, "up")).toBe("NO_CHANGE");
    expect(await menuLayout(s.m.restaurantId)).toEqual([
      "Lanches: X-Burger(1), X-Salada(2)",
      "Bebidas: Suco(1), Água(2)",
      "Outros: Batata frita(1)",
    ]);
    expect((await moves(s.m.restaurantId)).map((a) => [a.action, a.changes, a.user_id])).toEqual([
      [
        "UPDATE",
        { event: "menu.product.move", name: "X-Salada", section: "Lanches", menuPosition: [2, 1] },
        s.chef.userId,
      ],
      [
        "UPDATE",
        { event: "menu.product.move", name: "X-Salada", section: "Lanches", menuPosition: [1, 2] },
        s.chef.userId,
      ],
    ]);
  });

  it("também vale dentro de Outros", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    // Sem seções, os cinco produtos estão em Outros na ordem em que foram criados.
    expect(await menuLayout(k.m.restaurantId)).toEqual([
      "Outros: X-Burger(1), Suco(2), X-Salada(3), Água(4), Batata frita(5)",
    ]);
    unwrap(await moveProduct(env.deps, k.m, { id: k.agua, direction: "up" }));
    expect(await menuLayout(k.m.restaurantId)).toEqual([
      "Outros: X-Burger(1), Suco(2), Água(3), X-Salada(4), Batata frita(5)",
    ]);
    expect((await moves(k.m.restaurantId))[0]!.changes).toMatchObject({
      section: "Outros",
      menuPosition: [4, 3],
    });
  });

  it("mudar a ordem não muda version, preço, versão do produto nem pedido já enviado", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const { token } = await tableWithQr(env, s.m, "5");
    const cookie = await scan(env, token);
    const sent = unwrap(
      await submitOrder(env.deps, cookie, {
        clientRequestId: crypto.randomUUID(),
        lines: [{ recipeId: s.salada, quantity: 1, unitPrice: "26.00", addons: [], removals: [] }],
      }),
    );
    const before = await recipeRow(s.salada);
    const versionBefore = unwrap(await getRecipe(env.deps, s.m, s.salada)).versionNumber;
    unwrap(await moveProduct(env.deps, s.chef, { id: s.salada, direction: "up" }));
    const after = await recipeRow(s.salada);
    expect({ ...after, menu_position: 0 }).toEqual({ ...before, menu_position: 0 });
    expect([before.menu_position, after.menu_position]).toEqual([2, 1]);
    expect(unwrap(await getRecipe(env.deps, s.m, s.salada)).versionNumber).toBe(versionBefore);
    const lines = await ownerTestDb().execute<{ recipe_id: string; unit_price: string }>(
      sql`select recipe_id, unit_price from order_lines where order_id = ${sent.orderId}`,
    );
    expect(lines.rows).toEqual([{ recipe_id: s.salada, unit_price: "26.00" }]);
  });

  it("dois movimentos ao mesmo tempo terminam com todos os produtos e sem posição repetida", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const results = await Promise.all([
      moveProduct(env.deps, k.chef, { id: k.suco, direction: "up" }),
      moveProduct(env.deps, k.m, { id: k.agua, direction: "up" }),
      moveProduct(env.deps, k.chef, { id: k.batata, direction: "up" }),
      moveProduct(env.deps, k.m, { id: k.salada, direction: "down" }),
    ]);
    expect(results.filter((r) => r.ok).length).toBeGreaterThanOrEqual(3);
    const rows = await ownerTestDb().execute<{ menu_position: number }>(
      sql`select menu_position from recipes where restaurant_id = ${k.m.restaurantId} and kind = 'DISH'
          order by menu_position`,
    );
    expect(rows.rows.map((r) => r.menu_position)).toEqual([1, 2, 3, 4, 5]);
  });

  it("preparo não tem ordem; sem permissão não mexe; de outro restaurante não existe", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const other = await menuKitchen(env);
    expect(code(await moveProduct(env.deps, s.chef, { id: s.molho, direction: "up" }))).toBe("NOT_A_DISH");
    expect(code(await moveProduct(env.deps, s.stockkeeper, { id: s.salada, direction: "up" }))).toBe(
      "FORBIDDEN",
    );
    expect(code(await moveProduct(env.deps, other.chef, { id: s.salada, direction: "up" }))).toBe(
      "NOT_FOUND",
    );
    expect(code(await moveProduct(env.deps, s.chef, { id: env.deps.ids.next(), direction: "up" }))).toBe(
      "NOT_FOUND",
    );
    expect(await moves(s.m.restaurantId)).toEqual([]);
  });
});

describe("produto criado ou trocado de tipo pela tela de produtos (spec 013, US3.2)", () => {
  const dish = (pao: string, name: string) => ({
    name,
    kind: "DISH" as const,
    yieldQuantity: null,
    yieldUnit: null,
    lines: [itemLine(pao, "1", "un")],
  });

  it("produto vendido novo entra no fim de Outros; preparo fica sem posição", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const novo = unwrap(await createRecipe(env.deps, s.m, dish(s.pao, "Pudim"))).id;
    expect(await recipeRow(novo)).toMatchObject({ menu_section_id: null, menu_position: 2 });
    expect((await recipeRow(s.molho)).menu_position).toBe(0);
    expect((await menuLayout(s.m.restaurantId)).at(-1)).toBe("Outros: Batata frita(1), Pudim(2)");
  });

  it("produto vendido que vira preparo sai do cardápio; se voltar, entra no fim de Outros", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const prep = {
      ...dish(s.pao, "X-Salada"),
      kind: "SUB_RECIPE" as const,
      yieldQuantity: d("1"),
      yieldUnit: "un" as const,
    };
    await ownerTestDb().execute(
      sql`update recipes set sale_price = null, description = 'Com alface', photo_base = '/fotos/menu/x',
                             photo_widths = '{300}' where id = ${s.salada}`,
    );
    const updated = unwrap(await updateRecipe(env.deps, s.m, s.salada, 2, prep));
    expect(await recipeRow(s.salada)).toMatchObject({
      description: null,
      menu_section_id: null,
      menu_position: 0,
      photo_base: null,
      photo_widths: null,
    });
    unwrap(await updateRecipe(env.deps, s.m, s.salada, updated.version, dish(s.pao, "X-Salada")));
    expect(await recipeRow(s.salada)).toMatchObject({ menu_section_id: null, menu_position: 2 });
    // Editar o nome de um produto vendido não tira ele do lugar.
    unwrap(await updateRecipe(env.deps, s.m, s.burger, 2, { ...dish(s.pao, "X-Burger da casa") }));
    expect(await menuLayout(s.m.restaurantId)).toEqual([
      "Lanches: X-Burger da casa(1)",
      "Bebidas: Suco(1), Água(2)",
      "Outros: Batata frita(1), X-Salada(2)",
    ]);
  });
});
