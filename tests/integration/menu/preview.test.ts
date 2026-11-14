import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { ownerTestDb, testEnv } from "../harness";
import { code, menuScenario, unwrap } from "./fixtures";
import { scan, tableWithQr } from "../ordering/fixtures";
import { getMenuPreview } from "../../../src/application/menu/preview";
import { getMenu } from "../../../src/application/ordering/menu";
import { setProductSoldOut } from "../../../src/application/ordering/kitchen";

/** "Ver como o cliente" (spec 013, US5). */
const rows = async (restaurantId: string) => {
  const r = await ownerTestDb().execute<{ accesses: number; audit: number; orders: number }>(sql`
    select (select count(*)::int from menu_accesses where restaurant_id = ${restaurantId}) as accesses,
           (select count(*)::int from audit_log where restaurant_id = ${restaurantId}) as audit,
           (select count(*)::int from orders where restaurant_id = ${restaurantId}) as orders`);
  return r.rows[0]!;
};

describe("pré-visualização do cardápio (spec 013, US5)", () => {
  it("devolve o mesmo cardápio que o cliente vê na mesma hora", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    unwrap(await setProductSoldOut(env.deps, s.m, { recipeId: s.suco, soldOut: true }));
    const { token } = await tableWithQr(env, s.m, "7");
    const customer = unwrap(await getMenu(env.deps, await scan(env, token)));
    const preview = unwrap(await getMenuPreview(env.deps, s.chef));
    expect(preview).toEqual({ showSectionTitles: customer.showSectionTitles, sections: customer.sections });
    // Só o que dá para pedir: o Suco está esgotado hoje e a Batata frita não tem preço.
    expect(preview.sections.map((x) => [x.name, x.products.map((p) => p.name)])).toEqual([
      ["Lanches", ["X-Burger", "X-Salada"]],
      ["Bebidas", ["Água"]],
    ]);
  });

  it("não abre acesso, não conta pedido e não grava nada", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const before = await rows(s.m.restaurantId);
    unwrap(await getMenuPreview(env.deps, s.m));
    unwrap(await getMenuPreview(env.deps, s.chef));
    expect(await rows(s.m.restaurantId)).toEqual(before);
  });

  it("exige menu.write e não mostra o cardápio de outro restaurante", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const other = await menuScenario(env);
    expect(code(await getMenuPreview(env.deps, s.stockkeeper))).toBe("FORBIDDEN");
    const ids = unwrap(await getMenuPreview(env.deps, s.m)).sections.flatMap((x) =>
      x.products.map((p) => p.id),
    );
    expect(ids).toContain(s.burger);
    expect(ids).not.toContain(other.burger);
  });
});
