import { sql } from "drizzle-orm";
import { addMember, newRestaurant, ownerTestDb, type TestEnv } from "../harness";
import { orderingKitchen, unwrap } from "../ordering/fixtures";
import { itemLine } from "../../builders/recipe-data";
import { SECTION_NAMES } from "../../builders/menu-data";
import { createRecipe } from "../../../src/application/inventory/recipes";
import { setRecipeSalePrice } from "../../../src/application/inventory/product-costs";
import type { RequestContext } from "../../../src/application/context";
import type { Repos } from "../../../src/application/ports";
import { normalizeDescription } from "../../../src/domain/inventory/description";
import { d } from "../../../src/domain/shared/decimal";
import { ok } from "../../../src/domain/shared/result";

export { code, unwrap } from "../ordering/fixtures";

/** Roda `fn` com os repositórios do restaurante, numa transação confirmada. */
export const inTenant = async <T>(env: TestEnv, ctx: RequestContext, fn: (repos: Repos) => Promise<T>) =>
  unwrap(await env.deps.tenant(ctx.restaurantId, async (repos) => ok(await fn(repos))));

/**
 * Restaurante com gerente, chef e estoquista e os produtos vendidos X-Burger (R$ 28,00), Suco
 * (R$ 9,00), X-Salada (R$ 26,00), Água (R$ 5,00) e Batata frita (sem preço), mais o preparo Molho
 * da casa. Sem seções: tudo em "Outros".
 */
export async function menuKitchen(env: TestEnv) {
  const m = await newRestaurant(env);
  const chef = await addMember(env, m, ["CHEF"], "Chef");
  const stockkeeper = await addMember(env, m, ["STOCKKEEPER"], "Estoquista");
  const k = await orderingKitchen(env, m);
  const dish = async (name: string, price: string | null) => {
    const id = unwrap(
      await createRecipe(env.deps, m, {
        name,
        kind: "DISH",
        yieldQuantity: null,
        yieldUnit: null,
        lines: [itemLine(k.pao, "1", "un")],
      }),
    ).id;
    if (price) unwrap(await setRecipeSalePrice(env.deps, m, id, 1, d(price)));
    return id;
  };
  const salada = await dish("X-Salada", "26.00");
  const agua = await dish("Água", "5.00");
  const batata = await dish("Batata frita", null);
  return { m, chef, stockkeeper, ...k, salada, agua, batata };
}

/** Cria a seção direto pelo repositório, no fim. */
export async function addSection(env: TestEnv, ctx: RequestContext, name: string): Promise<string> {
  const id = env.deps.ids.next();
  await inTenant(env, ctx, async (repos) => {
    const position = (await repos.menuBoard.sections()).length + 1;
    await repos.menuBoard.insertSection(
      { id, name, normalized: normalizeDescription(name), position },
      { at: env.clock.now(), by: ctx.userId },
    );
  });
  return id;
}

/**
 * `menuKitchen` com as seções Entradas (vazia), Lanches (X-Burger, X-Salada) e Bebidas (Suco,
 * Água); a Batata frita fica em "Outros".
 */
export async function menuScenario(env: TestEnv) {
  const k = await menuKitchen(env);
  const entradas = await addSection(env, k.m, SECTION_NAMES[0]);
  const lanches = await addSection(env, k.m, SECTION_NAMES[1]);
  const bebidas = await addSection(env, k.m, SECTION_NAMES[2]);
  await inTenant(env, k.m, async (repos) => {
    await repos.menuBoard.placeProducts(lanches, [k.burger, k.salada]);
    await repos.menuBoard.placeProducts(bebidas, [k.suco, k.agua]);
    await repos.menuBoard.placeProducts(null, [k.batata]);
  });
  return { ...k, entradas, lanches, bebidas };
}

/** Como o banco está: "seção: produto(posição), …" na ordem do cardápio, para conferir de fora. */
export async function menuLayout(restaurantId: string): Promise<string[]> {
  const r = await ownerTestDb().execute<{ line: string }>(sql`
    select coalesce(s.name, 'Outros') || ': ' ||
           string_agg(r.name || '(' || r.menu_position || ')', ', ' order by r.menu_position, r.name) as line
    from recipes r left join menu_sections s on s.id = r.menu_section_id
    where r.restaurant_id = ${restaurantId} and r.kind = 'DISH'
    group by s.id, s.name, s.position
    order by s.position nulls last`);
  return r.rows.map((x) => x.line);
}

export async function recipeRow(id: string) {
  const r = await ownerTestDb().execute<{
    version: number;
    description: string | null;
    menu_section_id: string | null;
    menu_position: number;
    photo_base: string | null;
    photo_widths: number[] | null;
    sale_price: string | null;
  }>(sql`select version, description, menu_section_id, menu_position, photo_base, photo_widths, sale_price
         from recipes where id = ${id}`);
  return r.rows[0]!;
}
