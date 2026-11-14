import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { ownerTestDb, testEnv } from "../harness";
import { code, inTenant, menuKitchen, menuLayout, menuScenario, unwrap } from "./fixtures";
import {
  createSection,
  deleteSection,
  moveSection,
  renameSection,
} from "../../../src/application/menu/sections";
import { textOf } from "../../builders/menu-data";

/** Seções do cardápio (spec 013, US2). */
const audit = async (restaurantId: string, entity = "menu_section") => {
  const r = await ownerTestDb().execute<{
    action: string;
    changes: Record<string, unknown>;
    user_id: string;
  }>(
    sql`select action, changes, user_id from audit_log
        where restaurant_id = ${restaurantId} and entity = ${entity} order by occurred_at, id`,
  );
  return r.rows;
};
const sectionNames = async (env: ReturnType<typeof testEnv>, ctx: Parameters<typeof inTenant>[1]) =>
  (await inTenant(env, ctx, (repos) => repos.menuBoard.sections())).map((s) => `${s.position} ${s.name}`);

describe("seções do cardápio (spec 013, US2)", () => {
  it("o chef cria seções; cada uma entra no fim e fica na auditoria", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const first = unwrap(await createSection(env.deps, k.chef, { name: "  Entradas " }));
    unwrap(await createSection(env.deps, k.chef, { name: "Lanches" }));
    unwrap(await createSection(env.deps, k.m, { name: "Bebidas" }));
    expect(await sectionNames(env, k.m)).toEqual(["1 Entradas", "2 Lanches", "3 Bebidas"]);
    const log = await audit(k.m.restaurantId);
    expect(log).toHaveLength(3);
    expect(log[0]).toEqual({
      action: "CREATE",
      user_id: k.chef.userId,
      changes: { event: "menu.section.create", name: [null, "Entradas"], position: [null, 1] },
    });
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("recusa nome repetido, vazio, com 41 caracteres e 'Outros'", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const create = async (name: string) => code(await createSection(env.deps, s.chef, { name }));
    expect(await create("lánches")).toBe("NAME_IN_USE");
    expect(await create("   ")).toBe("INVALID_NAME");
    expect(await create(textOf(41))).toBe("INVALID_NAME");
    expect(await create("outros")).toBe("NAME_IN_USE");
    expect(await create(textOf(40))).toBe("OK");
    const dup = await createSection(env.deps, s.chef, { name: "LANCHES" });
    expect(dup).toMatchObject({ error: { field: "name", details: { section: "Lanches" } } });
  });

  it("renomeia com trava otimista e audita o nome antigo e o novo", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const rename = async (name: string, version: number, id = s.entradas) =>
      code(await renameSection(env.deps, s.chef, { id, version, name }));
    expect(await rename("Petiscos", 1)).toBe("OK");
    expect(await rename("Porções", 1)).toBe("STALE_RECORD");
    expect(await rename("Bebidas", 2)).toBe("NAME_IN_USE");
    expect(await rename("", 2)).toBe("INVALID_NAME");
    expect(await rename("PETISCOS", 2)).toBe("OK");
    expect(await rename("Porções", 1, env.deps.ids.next())).toBe("NOT_FOUND");
    expect(await sectionNames(env, s.m)).toEqual(["1 PETISCOS", "2 Lanches", "3 Bebidas"]);
    expect((await audit(s.m.restaurantId)).map((a) => a.changes)).toEqual([
      { event: "menu.section.rename", name: ["Entradas", "Petiscos"] },
      { event: "menu.section.rename", name: ["Petiscos", "PETISCOS"] },
    ]);
  });

  it("salvar o mesmo nome não muda nada nem enche a auditoria", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    expect(code(await renameSection(env.deps, s.chef, { id: s.lanches, version: 1, name: "Lanches" }))).toBe(
      "OK",
    );
    expect(await audit(s.m.restaurantId)).toEqual([]);
    const [, lanches] = await inTenant(env, s.m, (repos) => repos.menuBoard.sections());
    expect(lanches!.version).toBe(1);
  });

  it("sobe e desce trocando com a vizinha; na ponta não muda", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const go = async (id: string, direction: "up" | "down") =>
      code(await moveSection(env.deps, s.chef, { id, direction }));
    expect(await go(s.bebidas, "up")).toBe("OK");
    expect(await sectionNames(env, s.m)).toEqual(["1 Entradas", "2 Bebidas", "3 Lanches"]);
    expect(await go(s.entradas, "down")).toBe("OK");
    expect(await sectionNames(env, s.m)).toEqual(["1 Bebidas", "2 Entradas", "3 Lanches"]);
    expect(await go(s.bebidas, "up")).toBe("NO_CHANGE");
    expect(await go(s.lanches, "down")).toBe("NO_CHANGE");
    expect(await go(env.deps.ids.next(), "up")).toBe("NOT_FOUND");
    expect((await audit(s.m.restaurantId)).map((a) => [a.action, a.changes])).toEqual([
      ["UPDATE", { event: "menu.section.move", name: "Bebidas", position: [3, 2] }],
      ["UPDATE", { event: "menu.section.move", name: "Entradas", position: [1, 2] }],
    ]);
    // Os produtos continuam nas suas seções.
    expect(await menuLayout(s.m.restaurantId)).toEqual([
      "Bebidas: Suco(1), Água(2)",
      "Lanches: X-Burger(1), X-Salada(2)",
      "Outros: Batata frita(1)",
    ]);
  });

  it("apagar manda os produtos para o fim de Outros e fecha o buraco na ordem", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const r = unwrap(await deleteSection(env.deps, s.chef, { id: s.lanches }));
    expect(r).toEqual({ movedProducts: 2 });
    expect(await sectionNames(env, s.m)).toEqual(["1 Entradas", "2 Bebidas"]);
    expect(await menuLayout(s.m.restaurantId)).toEqual([
      "Bebidas: Suco(1), Água(2)",
      "Outros: Batata frita(1), X-Burger(2), X-Salada(3)",
    ]);
    expect(unwrap(await deleteSection(env.deps, s.chef, { id: s.entradas }))).toEqual({ movedProducts: 0 });
    expect(code(await deleteSection(env.deps, s.chef, { id: s.lanches }))).toBe("NOT_FOUND");
    expect((await audit(s.m.restaurantId)).map((a) => [a.action, a.changes])).toEqual([
      ["DEACTIVATE", { event: "menu.section.delete", name: ["Lanches", null], movedProducts: 2 }],
      ["DEACTIVATE", { event: "menu.section.delete", name: ["Entradas", null], movedProducts: 0 }],
    ]);
  });

  it("estoquista não mexe em seção e a tentativa fica na auditoria", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const tries = [
      await createSection(env.deps, s.stockkeeper, { name: "Sobremesas" }),
      await renameSection(env.deps, s.stockkeeper, { id: s.lanches, version: 1, name: "Burgers" }),
      await moveSection(env.deps, s.stockkeeper, { id: s.lanches, direction: "up" }),
      await deleteSection(env.deps, s.stockkeeper, { id: s.lanches }),
    ];
    expect(tries.map(code)).toEqual(["FORBIDDEN", "FORBIDDEN", "FORBIDDEN", "FORBIDDEN"]);
    expect(await sectionNames(env, s.m)).toEqual(["1 Entradas", "2 Lanches", "3 Bebidas"]);
    const log = await audit(s.m.restaurantId);
    expect(log.map((a) => [a.action, a.changes, a.user_id])).toEqual(
      Array(4).fill(["DENIED", { action: "menu.write" }, s.stockkeeper.userId]),
    );
  });

  it("seção de outro restaurante não existe", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const other = await menuKitchen(env);
    expect(code(await renameSection(env.deps, other.chef, { id: s.lanches, version: 1, name: "X" }))).toBe(
      "NOT_FOUND",
    );
    expect(code(await moveSection(env.deps, other.chef, { id: s.lanches, direction: "up" }))).toBe(
      "NOT_FOUND",
    );
    expect(code(await deleteSection(env.deps, other.chef, { id: s.lanches }))).toBe("NOT_FOUND");
    expect(await sectionNames(env, s.m)).toEqual(["1 Entradas", "2 Lanches", "3 Bebidas"]);
  });
});
