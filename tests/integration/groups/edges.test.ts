import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testEnv, type TestEnv } from "../harness";
import { listGroupTree } from "../../../src/application/inventory/list-group-tree";
import {
  createGroup,
  createSubgroup,
  renameGroup,
  renameSubgroup,
  setGroupActive,
  setSubgroupActive,
} from "../../../src/application/inventory/groups";
import type { RequestContext } from "../../../src/application/context";
import type { Repos } from "../../../src/application/ports";
import { ok, type Result } from "../../../src/domain/shared/result";

/** Spec 018, US2: recusas de grupos e subgrupos (docs/produto/estoque/01) que ainda não tinham teste. */

const db = () => ownerTestDb().$client;
const code = (r: Result<unknown>) => (r.ok ? "OK" : r.error.code);
const fail = (r: Result<unknown>) => (r.ok ? "OK" : `${r.error.code}@${r.error.field ?? ""}`);
const value = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
};
const version = async (table: "item_groups" | "item_subgroups", id: string) =>
  (await db().query(`select version from ${table} where id = $1`, [id])).rows[0].version as number;
const auditOf = async (entityId: string) =>
  (
    await db().query("select action, changes from audit_log where entity_id = $1 order by occurred_at, id", [
      entityId,
    ])
  ).rows;

async function setup(env: TestEnv) {
  const m = await newRestaurant(env);
  const chef = await addMember(env, m, ["CHEF"]);
  const gas = value(
    await createGroup(env.deps, m, { name: "Gás", storageClass: "OTHER_NON_FOOD", inCogs: false }),
  );
  return { m, chef, gas };
}

describe("criar grupo e subgrupo: recusas (spec 001, US2)", () => {
  it("nome com 2 a 80 letras, aparado; 1 ou 81 é VALIDATION no campo name", async () => {
    const env = testEnv();
    const { m, gas } = await setup(env);
    const g = (name: string) =>
      createGroup(env.deps, m, { name, storageClass: "OTHER_NON_FOOD", inCogs: false });
    expect(fail(await g(" x "))).toBe("VALIDATION@name");
    expect(fail(await g("x".repeat(81)))).toBe("VALIDATION@name");
    expect(fail(await g("Gá"))).toBe("OK");
    expect(fail(await g("y".repeat(80)))).toBe("OK");
    expect(fail(await createSubgroup(env.deps, m, { groupId: gas.id, name: "x" }))).toBe("VALIDATION@name");
  });

  it("quem não gerencia grupos não cria nem grupo nem subgrupo", async () => {
    const env = testEnv();
    const { chef, gas } = await setup(env);
    expect(
      code(
        await createGroup(env.deps, chef, { name: "Limpeza", storageClass: "OTHER_NON_FOOD", inCogs: false }),
      ),
    ).toBe("FORBIDDEN");
    expect(code(await createSubgroup(env.deps, chef, { groupId: gas.id, name: "Botijões" }))).toBe(
      "FORBIDDEN",
    );
  });

  it("depois do grupo 99 não há código para outro grupo; depois do subgrupo 99 também não", async () => {
    const env = testEnv();
    const { m, gas } = await setup(env);
    await db().query("update restaurants set next_group_code = 100 where id = $1", [m.restaurantId]);
    expect(
      code(
        await createGroup(env.deps, m, { name: "Limpeza", storageClass: "OTHER_NON_FOOD", inCogs: false }),
      ),
    ).toBe("GROUP_CODES_EXHAUSTED");
    await db().query("update item_groups set next_subgroup_code = 100 where id = $1", [gas.id]);
    expect(code(await createSubgroup(env.deps, m, { groupId: gas.id, name: "Botijões" }))).toBe(
      "GROUP_CODES_EXHAUSTED",
    );
  });

  it("subgrupo em grupo que não existe ou inativo é recusado no campo groupId", async () => {
    const env = testEnv();
    const { m, gas } = await setup(env);
    expect(fail(await createSubgroup(env.deps, m, { groupId: crypto.randomUUID(), name: "Botijões" }))).toBe(
      "NOT_FOUND@groupId",
    );
    value(await setGroupActive(env.deps, m, gas.id, await version("item_groups", gas.id), false));
    expect(fail(await createSubgroup(env.deps, m, { groupId: gas.id, name: "Botijões" }))).toBe(
      "SUBGROUP_INACTIVE@groupId",
    );
  });
});

describe("renomear: recusas (spec 001, US2)", () => {
  it("grupo e subgrupo: sem permissão, nome inválido, não existe, versão velha e nome repetido", async () => {
    const env = testEnv();
    const { m, chef, gas } = await setup(env);
    value(await createGroup(env.deps, m, { name: "Limpeza", storageClass: "OTHER_NON_FOOD", inCogs: false }));
    const sub = value(await createSubgroup(env.deps, m, { groupId: gas.id, name: "Botijões" }));
    value(await createSubgroup(env.deps, m, { groupId: gas.id, name: "Mangueiras" }));
    for (const [rename, id, taken] of [
      [renameGroup, gas.id, "Limpeza"],
      [renameSubgroup, sub.id, "Mangueiras"],
    ] as const) {
      expect(code(await rename(env.deps, chef, id, 1, "Outro nome"))).toBe("FORBIDDEN");
      expect(fail(await rename(env.deps, m, id, 1, "x"))).toBe("VALIDATION@name");
      expect(code(await rename(env.deps, m, crypto.randomUUID(), 1, "Outro nome"))).toBe("NOT_FOUND");
      expect(code(await rename(env.deps, m, id, 99, "Outro nome"))).toBe("STALE_RECORD");
      expect(fail(await rename(env.deps, m, id, 1, taken.toUpperCase()))).toBe("NAME_IN_USE@name");
    }
  });
});

describe("ativar e inativar (spec 001, US2, FR-010)", () => {
  it("grupo sem itens inativa e volta; o histórico grava as duas", async () => {
    const env = testEnv();
    const { m, gas } = await setup(env);
    value(await setGroupActive(env.deps, m, gas.id, await version("item_groups", gas.id), false));
    value(await setGroupActive(env.deps, m, gas.id, await version("item_groups", gas.id), true));
    expect((await auditOf(gas.id)).slice(1)).toEqual([
      { action: "DEACTIVATE", changes: { active: [true, false] } },
      { action: "REACTIVATE", changes: { active: [false, true] } },
    ]);
  });

  it("grupo: sem permissão, não existe e versão velha", async () => {
    const env = testEnv();
    const { m, chef, gas } = await setup(env);
    expect(code(await setGroupActive(env.deps, chef, gas.id, 1, false))).toBe("FORBIDDEN");
    expect(code(await setGroupActive(env.deps, m, crypto.randomUUID(), 1, false))).toBe("NOT_FOUND");
    expect(code(await setGroupActive(env.deps, m, gas.id, 99, false))).toBe("STALE_RECORD");
    // Grupo padrão pode ser reativado (só inativar é proibido).
    const bebidas = value(await listGroupTree(env.deps, m)).find((g) => g.name === "Bebidas")!;
    expect(code(await setGroupActive(env.deps, m, bebidas.id, bebidas.version, true))).toBe("OK");
  });

  it("subgrupo: sem permissão, não existe, versão velha, e reativar grava no histórico", async () => {
    const env = testEnv();
    const { m, chef } = await setup(env);
    const empty = await subgroupId(env, m, "01", "04");
    expect(code(await setSubgroupActive(env.deps, chef, empty, 1, false))).toBe("FORBIDDEN");
    expect(code(await setSubgroupActive(env.deps, m, crypto.randomUUID(), 1, false))).toBe("NOT_FOUND");
    expect(code(await setSubgroupActive(env.deps, m, empty, 99, false))).toBe("STALE_RECORD");
    value(await setSubgroupActive(env.deps, m, empty, 1, false));
    value(await setSubgroupActive(env.deps, m, empty, 2, true));
    expect((await auditOf(empty)).map((r) => r.action).slice(-2)).toEqual(["DEACTIVATE", "REACTIVATE"]);
  });
});

describe("repositório de grupos (spec 001, data-model.md)", () => {
  const inRepos = <T>(env: TestEnv, ctx: RequestContext, fn: (repos: Repos) => Promise<T>) =>
    env.deps.tenant(ctx.restaurantId, async (repos) => ok(await fn(repos)));

  it("grupo novo, ainda sem subgrupo, aparece na árvore com a lista vazia", async () => {
    const env = testEnv();
    const { m, gas } = await setup(env);
    const tree = value(await inRepos(env, m, (repos) => repos.groups.tree(false)));
    expect(tree.find((g) => g.id === gas.id)?.subgroups).toEqual([]);
  });

  it("erro do banco que não é nome repetido sobe como erro", async () => {
    const env = testEnv();
    const { m, gas } = await setup(env);
    const audit = { at: env.clock.now(), by: m.userId };
    await expect(
      inRepos(env, m, (repos) =>
        repos.groups.insertGroup(
          { id: "x", code: "50", name: "Z", storageClass: "OTHER_NON_FOOD", inCogs: false },
          audit,
        ),
      ),
    ).rejects.toThrow();
    await expect(
      inRepos(env, m, (repos) =>
        repos.groups.insertSubgroup({ id: "x", groupId: gas.id, code: "50", name: "Z" }, audit),
      ),
    ).rejects.toThrow();
    await expect(inRepos(env, m, (repos) => repos.groups.renameGroup("x", "Z", 1, audit))).rejects.toThrow();
  });
});
