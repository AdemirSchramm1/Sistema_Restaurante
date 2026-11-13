import { describe, expect, it } from "vitest";
import { testEnv } from "../harness";
import { addSection, code, inTenant, menuKitchen, menuLayout, menuScenario, recipeRow } from "./fixtures";

/** Repositório da tela Cardápio (spec 013, data-model.md). */
describe("menu-repository (spec 013)", () => {
  const stamp = (env: ReturnType<typeof testEnv>, userId: string) => ({ at: env.clock.now(), by: userId });

  it("lista as seções na ordem e os produtos vendidos por seção e posição", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const { sections, products } = await inTenant(env, s.m, async (repos) => ({
      sections: await repos.menuBoard.sections(),
      products: await repos.menuBoard.products(),
    }));
    expect(sections.map((x) => [x.name, x.normalized, x.position, x.version])).toEqual([
      ["Entradas", "entradas", 1, 1],
      ["Lanches", "lanches", 2, 1],
      ["Bebidas", "bebidas", 3, 1],
    ]);
    const bySection = (id: string | null) => products.filter((p) => p.sectionId === id).map((p) => p.name);
    expect(bySection(s.lanches)).toEqual(["X-Burger", "X-Salada"]);
    expect(bySection(s.bebidas)).toEqual(["Suco", "Água"]);
    expect(bySection(null)).toEqual(["Batata frita"]);
    // "Outros" vem no fim e o preparo não vem.
    expect(products.at(-1)!.name).toBe("Batata frita");
    expect(products.map((p) => p.name)).not.toContain("Molho da casa");
    const burger = products.find((p) => p.id === s.burger)!;
    expect(burger).toMatchObject({
      kind: "DISH",
      active: true,
      soldOutOn: null,
      description: null,
      photo: null,
      menuPosition: 1,
      version: 2,
    });
    expect(burger.salePrice!.toFixed(2)).toBe("28.00");
    expect(products.find((p) => p.id === s.batata)!.salePrice).toBeNull();
  });

  it("devolve produto ou preparo pelo id, e nada de outro restaurante", async () => {
    const env = testEnv();
    const s = await menuKitchen(env);
    const other = await menuKitchen(env);
    const found = await inTenant(env, s.m, async (repos) => ({
      dish: await repos.menuBoard.product(s.burger),
      prep: await repos.menuBoard.product(s.molho),
      foreign: await repos.menuBoard.product(other.burger),
    }));
    expect(found.dish).toMatchObject({ name: "X-Burger", kind: "DISH", sectionId: null });
    expect(found.prep).toMatchObject({ name: "Molho da casa", kind: "SUB_RECIPE", menuPosition: 0 });
    expect(found.foreign).toBeNull();
  });

  it("põe os produtos numa seção na ordem pedida, a partir de 1", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    await inTenant(env, s.m, async (repos) => {
      await repos.menuBoard.lock();
      await repos.menuBoard.placeProducts(s.lanches, [s.salada, s.burger, s.batata]);
      await repos.menuBoard.placeProducts(null, []);
    });
    expect(await menuLayout(s.m.restaurantId)).toEqual([
      "Lanches: X-Salada(1), X-Burger(2), Batata frita(3)",
      "Bebidas: Suco(1), Água(2)",
    ]);
    // Mudar de lugar não mexe na trava otimista do produto.
    expect((await recipeRow(s.burger)).version).toBe(2);
  });

  it("grava a descrição subindo a version; version antiga é recusada", async () => {
    const env = testEnv();
    const s = await menuKitchen(env);
    const r = await inTenant(env, s.m, async (repos) => ({
      first: code(
        await repos.menuBoard.setDescription(s.burger, "Pão, carne e queijo", 2, stamp(env, s.m.userId)),
      ),
      stale: code(await repos.menuBoard.setDescription(s.burger, "Outra", 2, stamp(env, s.m.userId))),
      missing: code(
        await repos.menuBoard.setDescription(env.deps.ids.next(), "x", 1, stamp(env, s.m.userId)),
      ),
      cleared: code(await repos.menuBoard.setDescription(s.burger, null, 3, stamp(env, s.m.userId))),
    }));
    expect(r).toEqual({ first: "OK", stale: "STALE_RECORD", missing: "NOT_FOUND", cleared: "OK" });
    expect(await recipeRow(s.burger)).toMatchObject({ description: null, version: 4 });
  });

  it("grava e limpa a foto sem subir a version", async () => {
    const env = testEnv();
    const s = await menuKitchen(env);
    const photo = { base: "/fotos/menu/abc", widths: [300, 600] };
    const read = await inTenant(env, s.m, async (repos) => {
      await repos.menuBoard.setPhoto(s.burger, photo, stamp(env, s.chef.userId));
      return repos.menuBoard.product(s.burger);
    });
    expect(read!.photo).toEqual(photo);
    expect(await recipeRow(s.burger)).toMatchObject({
      photo_base: "/fotos/menu/abc",
      photo_widths: [300, 600],
      version: 2,
    });
    await inTenant(env, s.m, (repos) => repos.menuBoard.setPhoto(s.burger, null, stamp(env, s.chef.userId)));
    expect(await recipeRow(s.burger)).toMatchObject({ photo_base: null, photo_widths: null, version: 2 });
  });

  it("seção: nome repetido é NAME_IN_USE e a transação continua valendo", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const r = await inTenant(env, s.m, async (repos) => {
      const dup = await repos.menuBoard.insertSection(
        { id: env.deps.ids.next(), name: "LANCHES", normalized: "lanches", position: 4 },
        stamp(env, s.m.userId),
      );
      const fine = await repos.menuBoard.insertSection(
        { id: env.deps.ids.next(), name: "Sobremesas", normalized: "sobremesas", position: 4 },
        stamp(env, s.m.userId),
      );
      return [dup, code(fine)];
    });
    expect(r).toEqual([{ ok: false, error: { code: "NAME_IN_USE", field: "name" } }, "OK"]);
  });

  it("seção: renomeia com trava otimista", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const rename = (id: string, name: string, version: number) =>
      inTenant(env, s.m, async (repos) =>
        code(
          await repos.menuBoard.renameSection(
            id,
            { name, normalized: name.toLowerCase() },
            version,
            stamp(env, s.m.userId),
          ),
        ),
      );
    expect(await rename(s.entradas, "Petiscos", 1)).toBe("OK");
    expect(await rename(s.entradas, "Porções", 1)).toBe("STALE_RECORD");
    expect(await rename(env.deps.ids.next(), "Porções", 1)).toBe("NOT_FOUND");
    expect(await rename(s.entradas, "Lanches", 2)).toBe("NAME_IN_USE");
    const sections = await inTenant(env, s.m, (repos) => repos.menuBoard.sections());
    expect(sections[0]).toMatchObject({ name: "Petiscos", normalized: "petiscos", version: 2 });
  });

  it("seção: regrava a ordem e apaga", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const sobremesas = await addSection(env, s.m, "Sobremesas");
    const names = await inTenant(env, s.m, async (repos) => {
      await repos.menuBoard.orderSections([s.bebidas, sobremesas, s.lanches, s.entradas]);
      await repos.menuBoard.placeProducts(null, [s.batata, s.burger, s.salada]);
      await repos.menuBoard.deleteSection(s.lanches);
      await repos.menuBoard.orderSections([s.bebidas, sobremesas, s.entradas]);
      return (await repos.menuBoard.sections()).map((x) => `${x.position} ${x.name}`);
    });
    expect(names).toEqual(["1 Bebidas", "2 Sobremesas", "3 Entradas"]);
  });
});
