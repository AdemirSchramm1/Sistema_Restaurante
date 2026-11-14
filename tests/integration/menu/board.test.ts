import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { testEnv, type TestEnv } from "../harness";
import { code, inTenant, menuKitchen, menuScenario, unwrap } from "./fixtures";
import { countingEnv } from "../performance/counting";
import { getMenuBoard } from "../../../src/application/menu/board";
import { setProductSoldOut } from "../../../src/application/ordering/kitchen";
import { createRecipe, setRecipeActive } from "../../../src/application/inventory/recipes";
import { itemLine } from "../../builders/recipe-data";

/** Tela Cardápio da equipe (spec 013, US2 e contracts/use-cases.md). */
describe("tela Cardápio (spec 013, US2)", () => {
  let env: TestEnv;
  let counting: ReturnType<typeof countingEnv>;
  beforeEach(() => {
    env = testEnv();
    counting = countingEnv(env);
  });
  afterEach(() => counting.close());

  it("mostra as seções na ordem, a vazia também, e Outros no fim", async () => {
    const s = await menuScenario(env);
    const board = unwrap(await getMenuBoard(env.deps, s.chef));
    expect(
      board.sections.map((x) => [
        x.name,
        x.id,
        x.version,
        x.canMoveUp,
        x.canMoveDown,
        x.products.map((p) => p.name),
      ]),
    ).toEqual([
      ["Entradas", s.entradas, 1, false, true, []],
      ["Lanches", s.lanches, 1, true, true, ["X-Burger", "X-Salada"]],
      ["Bebidas", s.bebidas, 1, true, false, ["Suco", "Água"]],
      ["Outros", null, null, false, false, ["Batata frita"]],
    ]);
  });

  it("cada produto vem com preço, situação, foto e se pode subir ou descer", async () => {
    const s = await menuScenario(env);
    unwrap(await setProductSoldOut(env.deps, s.chef, { recipeId: s.suco, soldOut: true }));
    unwrap(await setRecipeActive(env.deps, s.m, s.salada, 2, false));
    const photo = { base: "/fotos/menu/abc", widths: [300, 600] };
    await inTenant(env, s.m, (repos) =>
      repos.menuBoard.setPhoto(s.burger, photo, { at: env.clock.now(), by: s.m.userId }),
    );
    const board = unwrap(await getMenuBoard(env.deps, s.m));
    const [, lanches, bebidas, outros] = board.sections;
    expect(lanches!.products).toEqual([
      {
        id: s.burger,
        name: "X-Burger",
        price: "28.00",
        active: true,
        soldOutToday: false,
        photo,
        canMoveUp: false,
        canMoveDown: true,
      },
      {
        id: s.salada,
        name: "X-Salada",
        price: "26.00",
        active: false,
        soldOutToday: false,
        photo: null,
        canMoveUp: true,
        canMoveDown: false,
      },
    ]);
    expect(bebidas!.products[0]).toMatchObject({ name: "Suco", soldOutToday: true });
    expect(outros!.products).toEqual([
      {
        id: s.batata,
        name: "Batata frita",
        price: null,
        active: true,
        soldOutToday: false,
        photo: null,
        canMoveUp: false,
        canMoveDown: false,
      },
    ]);
  });

  it("sem seção nenhuma, tudo fica em Outros; preparo não aparece", async () => {
    const k = await menuKitchen(env);
    const board = unwrap(await getMenuBoard(env.deps, k.chef));
    expect(board.sections).toHaveLength(1);
    expect(board.sections[0]).toMatchObject({ id: null, name: "Outros", version: null });
    const names = board.sections[0]!.products.map((p) => p.name);
    expect(names).toHaveLength(5);
    expect(names).not.toContain("Molho da casa");
  });

  it("restaurante sem produto vendido e sem seção não tem nem Outros", async () => {
    const k = await menuKitchen(env);
    const empty = await import("../harness").then((h) => h.newRestaurant(env, "Restaurante vazio"));
    expect(unwrap(await getMenuBoard(env.deps, empty))).toEqual({ sections: [] });
    expect(unwrap(await getMenuBoard(env.deps, k.m)).sections).toHaveLength(1);
  });

  it("só quem tem menu.write abre a tela", async () => {
    const k = await menuKitchen(env);
    expect(code(await getMenuBoard(env.deps, k.stockkeeper))).toBe("FORBIDDEN");
  });

  it("faz o mesmo número de consultas com 5 ou com 25 produtos", async () => {
    const s = await menuScenario(env);
    unwrap(await getMenuBoard(counting.deps, s.chef));
    counting.take();
    unwrap(await getMenuBoard(counting.deps, s.chef));
    const few = counting.take();
    for (let i = 0; i < 20; i++)
      unwrap(
        await createRecipe(env.deps, s.m, {
          name: `Produto ${i}`,
          kind: "DISH",
          yieldQuantity: null,
          yieldUnit: null,
          lines: [itemLine(s.pao, "1", "un")],
        }),
      );
    const board = unwrap(await getMenuBoard(counting.deps, s.chef));
    expect(board.sections.at(-1)!.products).toHaveLength(21);
    expect(counting.take()).toBe(few);
  });
});
