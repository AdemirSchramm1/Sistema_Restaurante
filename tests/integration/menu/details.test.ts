import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { ownerTestDb, testEnv } from "../harness";
import { code, menuKitchen, menuLayout, menuScenario, recipeRow, unwrap } from "./fixtures";
import { getMenuProduct, setMenuDetails } from "../../../src/application/menu/details";
import { getRecipe } from "../../../src/application/inventory/recipes";
import { setProductSoldOut } from "../../../src/application/ordering/kitchen";
import { textOf } from "../../builders/menu-data";

/** Descrição e seção do produto (spec 013, US1.6, US1.7 e US3.3). */
const detailsAudit = async (restaurantId: string) => {
  const r = await ownerTestDb().execute<{
    action: string;
    changes: Record<string, unknown>;
    user_id: string;
  }>(
    sql`select action, changes, user_id from audit_log
        where restaurant_id = ${restaurantId} and changes->>'event' = 'menu.details' order by occurred_at, id`,
  );
  return r.rows;
};

describe("descrição e seção do produto (spec 013, US1)", () => {
  it("grava a descrição limpa e a seção, põe no fim da seção nova e sobe a version", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    unwrap(
      await setMenuDetails(env.deps, s.chef, {
        id: s.batata,
        version: 1,
        description: "  Porção para dois.\r\nCom cheddar.  ",
        sectionId: s.lanches,
      }),
    );
    expect(await recipeRow(s.batata)).toMatchObject({
      description: "Porção para dois.\nCom cheddar.",
      menu_section_id: s.lanches,
      menu_position: 3,
      version: 2,
    });
    expect(await menuLayout(s.m.restaurantId)).toEqual([
      "Lanches: X-Burger(1), X-Salada(2), Batata frita(3)",
      "Bebidas: Suco(1), Água(2)",
    ]);
    expect(await detailsAudit(s.m.restaurantId)).toEqual([
      {
        action: "UPDATE",
        user_id: s.chef.userId,
        changes: {
          event: "menu.details",
          menuDescription: [null, "Porção para dois.\nCom cheddar."],
          menuSection: ["Outros", "Lanches"],
        },
      },
    ]);
    // Não cria versão do produto (a ficha técnica não mudou).
    expect(unwrap(await getRecipe(env.deps, s.m, s.batata)).versionNumber).toBe(1);
  });

  it("sair de uma seção fecha o buraco; voltar para Outros entra no fim", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    unwrap(
      await setMenuDetails(env.deps, s.m, { id: s.burger, version: 2, description: "", sectionId: null }),
    );
    expect(await menuLayout(s.m.restaurantId)).toEqual([
      "Lanches: X-Salada(1)",
      "Bebidas: Suco(1), Água(2)",
      "Outros: Batata frita(1), X-Burger(2)",
    ]);
    expect((await detailsAudit(s.m.restaurantId))[0]!.changes).toEqual({
      event: "menu.details",
      menuSection: ["Lanches", "Outros"],
    });
  });

  it("mudar só a descrição mantém o lugar; salvar igual não enche a auditoria", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const save = (version: number, description: string) =>
      setMenuDetails(env.deps, s.m, { id: s.burger, version, description, sectionId: s.lanches });
    unwrap(await save(2, "Pão, carne e queijo"));
    unwrap(await save(3, "Pão, carne e queijo"));
    unwrap(await save(4, "   "));
    expect(await recipeRow(s.burger)).toMatchObject({ description: null, menu_position: 1, version: 5 });
    expect((await detailsAudit(s.m.restaurantId)).map((a) => a.changes)).toEqual([
      { event: "menu.details", menuDescription: [null, "Pão, carne e queijo"] },
      { event: "menu.details", menuDescription: ["Pão, carne e queijo", null] },
    ]);
  });

  it("recusa descrição com 301 caracteres, seção que não existe e version antiga", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const other = await menuScenario(env);
    const save = async (over: Partial<Parameters<typeof setMenuDetails>[2]>) =>
      code(
        await setMenuDetails(env.deps, s.m, {
          id: s.burger,
          version: 2,
          description: "",
          sectionId: s.lanches,
          ...over,
        }),
      );
    expect(await save({ description: textOf(301) })).toBe("INVALID_DESCRIPTION");
    expect(await save({ description: textOf(300) })).toBe("OK");
    expect(await save({ version: 2 })).toBe("STALE_RECORD");
    expect(await save({ version: 3, sectionId: env.deps.ids.next() })).toBe("NOT_FOUND");
    expect(await save({ version: 3, sectionId: other.lanches })).toBe("NOT_FOUND");
    expect(await save({ id: s.molho, version: 1 })).toBe("NOT_A_DISH");
    expect(await save({ id: env.deps.ids.next() })).toBe("NOT_FOUND");
    expect(
      code(
        await setMenuDetails(env.deps, s.stockkeeper, {
          id: s.burger,
          version: 3,
          description: "",
          sectionId: null,
        }),
      ),
    ).toBe("FORBIDDEN");
    // A version antiga não mudou a seção de ninguém.
    expect((await menuLayout(s.m.restaurantId))[0]).toBe("Lanches: X-Burger(1), X-Salada(2)");
  });

  it("a tela do produto recebe o produto e as seções para escolher", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    unwrap(await setProductSoldOut(env.deps, s.chef, { recipeId: s.suco, soldOut: true }));
    unwrap(
      await setMenuDetails(env.deps, s.m, {
        id: s.suco,
        version: 2,
        description: "400 ml",
        sectionId: s.bebidas,
      }),
    );
    expect(unwrap(await getMenuProduct(env.deps, s.chef, s.suco))).toEqual({
      id: s.suco,
      name: "Suco",
      price: "9.00",
      active: true,
      soldOutToday: true,
      photo: null,
      description: "400 ml",
      sectionId: s.bebidas,
      version: 3,
      sections: [
        { id: s.entradas, name: "Entradas" },
        { id: s.lanches, name: "Lanches" },
        { id: s.bebidas, name: "Bebidas" },
      ],
    });
    expect(unwrap(await getMenuProduct(env.deps, s.m, s.batata))).toMatchObject({
      price: null,
      sectionId: null,
    });
    expect(code(await getMenuProduct(env.deps, s.chef, s.molho))).toBe("NOT_A_DISH");
    expect(code(await getMenuProduct(env.deps, s.chef, env.deps.ids.next()))).toBe("NOT_FOUND");
    expect(code(await getMenuProduct(env.deps, s.stockkeeper, s.suco))).toBe("FORBIDDEN");
    const k = await menuKitchen(env);
    expect(code(await getMenuProduct(env.deps, k.m, s.suco))).toBe("NOT_FOUND");
  });
});
