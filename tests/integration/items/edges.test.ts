import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testEnv, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { getItem } from "../../../src/application/inventory/get-item";
import { listGroupTree } from "../../../src/application/inventory/list-group-tree";
import { listItems } from "../../../src/application/inventory/list-items";
import { setItemActive } from "../../../src/application/inventory/set-item-active";
import { setItemCogsOverride } from "../../../src/application/inventory/set-item-cogs-override";
import { updateItem } from "../../../src/application/inventory/update-item";
import { setSubgroupActive } from "../../../src/application/inventory/groups";
import type { Repos } from "../../../src/application/ports";
import { ok, type Result } from "../../../src/domain/shared/result";

/** Spec 018, US2: recusas e casos do cadastro de itens (docs/produto/estoque/02) que faltavam. */

const db = () => ownerTestDb().$client;
const code = (r: Result<unknown>) => (r.ok ? "OK" : r.error.code);
const fail = (r: Result<unknown>) => (r.ok ? "OK" : `${r.error.code}@${r.error.field ?? ""}`);
const value = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
};
const auditOf = async (id: string) =>
  (
    await db().query(
      "select action, changes from audit_log where entity = 'item' and entity_id = $1 order by occurred_at, id",
      [id],
    )
  ).rows;

async function setup(env: TestEnv) {
  const m = await newRestaurant(env);
  const stockkeeper = await addMember(env, m, ["STOCKKEEPER"]);
  const waiter = await addMember(env, m, ["WAITER"]);
  const legumes = await subgroupId(env, m, "01", "02");
  const frutas = await subgroupId(env, m, "01", "03");
  const tomato = value(await createItem(env.deps, m, itemData({ subgroupId: legumes })));
  return { m, stockkeeper, waiter, legumes, frutas, tomato };
}

describe("cadastrar item: recusas (spec 001, US1)", () => {
  it("subgrupo inativo, ou de grupo inativo, é SUBGROUP_INACTIVE no campo subgroupId", async () => {
    const env = testEnv();
    const { m } = await setup(env);
    const empty = await subgroupId(env, m, "01", "04");
    value(await setSubgroupActive(env.deps, m, empty, 1, false));
    expect(fail(await createItem(env.deps, m, itemData({ subgroupId: empty })))).toBe(
      "SUBGROUP_INACTIVE@subgroupId",
    );
    const herbs = await subgroupId(env, m, "01", "01");
    await db().query(
      "update item_groups set active = false where id = (select group_id from item_subgroups where id = $1)",
      [herbs],
    );
    expect(fail(await createItem(env.deps, m, itemData({ subgroupId: herbs })))).toBe(
      "SUBGROUP_INACTIVE@subgroupId",
    );
  });

  it("depois do item 9999 do subgrupo não há código", async () => {
    const env = testEnv();
    const { m, legumes } = await setup(env);
    await db().query("update item_subgroups set next_item_seq = 10000 where id = $1", [legumes]);
    expect(
      code(await createItem(env.deps, m, itemData({ subgroupId: legumes, description: "Cenoura" }))),
    ).toBe("SUBGROUP_SEQUENCE_EXHAUSTED");
  });

  it("descrição repetida diz o código do item que já existe e não gasta número", async () => {
    const env = testEnv();
    const { m, legumes, tomato } = await setup(env);
    const dup = await createItem(
      env.deps,
      m,
      itemData({ subgroupId: legumes, description: "  TOMATE italiano " }),
    );
    expect(dup.ok ? null : [dup.error.code, dup.error.field, dup.error.details]).toEqual([
      "ITEM_DUPLICATE_DESCRIPTION",
      "description",
      { existingCode: tomato.code },
    ]);
    const next = value(
      await createItem(env.deps, m, itemData({ subgroupId: legumes, description: "Cenoura" })),
    );
    expect(next.code).toBe("01.02.0002");
  });
});

describe("ver e listar itens (spec 001, US3)", () => {
  it("garçom não vê o cadastro, a árvore nem um item", async () => {
    const env = testEnv();
    const { waiter, tomato } = await setup(env);
    expect(code(await listItems(env.deps, waiter, { page: 1 }))).toBe("FORBIDDEN");
    expect(code(await listGroupTree(env.deps, waiter))).toBe("FORBIDDEN");
    expect(code(await getItem(env.deps, waiter, tomato.id))).toBe("FORBIDDEN");
  });

  it("filtros por grupo, subgrupo, tipo, texto (também no código) e situação; página inválida vira 1", async () => {
    const env = testEnv();
    const { m, legumes, frutas, tomato } = await setup(env);
    const banana = value(
      await createItem(env.deps, m, itemData({ subgroupId: frutas, description: "Banana prata" })),
    );
    const pack = value(
      await createItem(
        env.deps,
        m,
        itemData({ subgroupId: frutas, description: "Sacola 50% reciclada", type: "CONSUMABLE" }),
      ),
    );
    value(await setItemActive(env.deps, m, banana.id, 1, false));
    const groupId = value(await listGroupTree(env.deps, m))[0]!.id;
    const codes = async (f: Parameters<typeof listItems>[2]) =>
      value(await listItems(env.deps, m, f)).rows.map((r) => r.code);
    expect(await codes({ page: Number.NaN })).toEqual([tomato.code, pack.code]);
    expect(value(await listItems(env.deps, m, { page: Number.NaN })).page).toBe(1);
    expect(await codes({ page: 1, groupId, status: "all" })).toEqual([tomato.code, banana.code, pack.code]);
    expect(await codes({ page: 1, subgroupId: legumes })).toEqual([tomato.code]);
    expect(await codes({ page: 1, type: "CONSUMABLE" })).toEqual([pack.code]);
    expect(await codes({ page: 1, status: "inactive" })).toEqual([banana.code]);
    expect(await codes({ page: 1, q: "tomate" })).toEqual([tomato.code]);
    expect(await codes({ page: 1, q: "01.03" })).toEqual([pack.code]);
    // "%" é letra, não curinga.
    expect(await codes({ page: 1, q: "50%" })).toEqual([pack.code]);
    expect(await codes({ page: 1, q: "%" })).toEqual([pack.code]);
    expect(value(await listItems(env.deps, m, { page: 1, q: "nada assim" })).total).toBe(0);
  });
});

describe("inativar e conta no CMV: recusas (spec 001, US4; spec 004)", () => {
  it("inativar: sem permissão e item que não existe; reativar grava REACTIVATE", async () => {
    const env = testEnv();
    const { m, stockkeeper, tomato } = await setup(env);
    expect(code(await setItemActive(env.deps, stockkeeper, tomato.id, 1, false))).toBe("FORBIDDEN");
    expect(code(await setItemActive(env.deps, m, crypto.randomUUID(), 1, false))).toBe("NOT_FOUND");
    value(await setItemActive(env.deps, m, tomato.id, 1, false));
    value(await setItemActive(env.deps, m, tomato.id, 2, true));
    expect((await auditOf(tomato.id)).map((r) => r.action).filter((a) => a !== "DENIED")).toEqual([
      "CREATE",
      "DEACTIVATE",
      "REACTIVATE",
    ]);
  });

  it("CMV: item que não existe, versão velha, e o mesmo valor não vai para o histórico", async () => {
    const env = testEnv();
    const { m, tomato } = await setup(env);
    expect(code(await setItemCogsOverride(env.deps, m, crypto.randomUUID(), 1, true))).toBe("NOT_FOUND");
    expect(code(await setItemCogsOverride(env.deps, m, tomato.id, 9, true))).toBe("STALE_RECORD");
    value(await setItemCogsOverride(env.deps, m, tomato.id, 1, null));
    expect(await auditOf(tomato.id)).toHaveLength(1);
  });
});

describe("editar item: recusas (spec 001, US1, FR-031)", () => {
  it("sem permissão e dados inválidos não chegam ao banco", async () => {
    const env = testEnv();
    const { m, stockkeeper, legumes, tomato } = await setup(env);
    expect(
      code(await updateItem(env.deps, stockkeeper, tomato.id, 1, itemData({ subgroupId: legumes }))),
    ).toBe("FORBIDDEN");
    expect(
      fail(await updateItem(env.deps, m, tomato.id, 1, itemData({ subgroupId: legumes, description: "" }))),
    ).toMatch(/@description$/);
  });

  it("trocar de subgrupo: para um que não existe ou inativo é recusado; para um ativo, o código fica", async () => {
    const env = testEnv();
    const { m, frutas, tomato } = await setup(env);
    expect(
      fail(await updateItem(env.deps, m, tomato.id, 1, itemData({ subgroupId: crypto.randomUUID() }))),
    ).toBe("NOT_FOUND@subgroupId");
    const empty = await subgroupId(env, m, "01", "04");
    value(await setSubgroupActive(env.deps, m, empty, 1, false));
    expect(fail(await updateItem(env.deps, m, tomato.id, 1, itemData({ subgroupId: empty })))).toBe(
      "SUBGROUP_INACTIVE@subgroupId",
    );
    await db().query(
      "update item_groups set active = false where id = (select group_id from item_subgroups where id = $1)",
      [frutas],
    );
    expect(fail(await updateItem(env.deps, m, tomato.id, 1, itemData({ subgroupId: frutas })))).toBe(
      "SUBGROUP_INACTIVE@subgroupId",
    );
    await db().query(
      "update item_groups set active = true where id = (select group_id from item_subgroups where id = $1)",
      [frutas],
    );
    value(await updateItem(env.deps, m, tomato.id, 1, itemData({ subgroupId: frutas })));
    expect(value(await getItem(env.deps, m, tomato.id)).item.code).toBe(tomato.code);
  });

  it("versão velha e descrição repetida são recusadas pelo banco; item inativo pode repetir", async () => {
    const env = testEnv();
    const { m, legumes, tomato } = await setup(env);
    const carrot = value(
      await createItem(env.deps, m, itemData({ subgroupId: legumes, description: "Cenoura" })),
    );
    expect(code(await updateItem(env.deps, m, tomato.id, 9, itemData({ subgroupId: legumes })))).toBe(
      "STALE_RECORD",
    );
    const dup = await updateItem(env.deps, m, carrot.id, 1, itemData({ subgroupId: legumes }));
    expect(dup.ok ? null : [dup.error.code, dup.error.details]).toEqual([
      "ITEM_DUPLICATE_DESCRIPTION",
      { existingCode: tomato.code },
    ]);
    value(await setItemActive(env.deps, m, carrot.id, 1, false));
    expect(code(await updateItem(env.deps, m, carrot.id, 2, itemData({ subgroupId: legumes })))).toBe("OK");
  });

  it("salvar sem mudar nada soma a versão e não escreve no histórico", async () => {
    const env = testEnv();
    const { m, legumes, tomato } = await setup(env);
    expect(value(await updateItem(env.deps, m, tomato.id, 1, itemData({ subgroupId: legumes })))).toEqual({
      version: 2,
    });
    expect(await auditOf(tomato.id)).toHaveLength(1);
  });
});

describe("repositório de itens (spec 001, data-model.md)", () => {
  it("erro do banco que não é descrição repetida sobe como erro", async () => {
    const env = testEnv();
    const { m, legumes } = await setup(env);
    const inRepos = (fn: (repos: Repos) => Promise<unknown>) =>
      env.deps.tenant(m.restaurantId, async (repos) => ok(await fn(repos)));
    await expect(
      inRepos((repos) =>
        repos.items.insert(
          {
            ...itemData({ subgroupId: legumes, description: "Cebola" }),
            id: "x",
            code: "01.02.0099",
            descriptionNormalized: "cebola",
          },
          { at: env.clock.now(), by: m.userId },
        ),
      ),
    ).rejects.toThrow();
  });
});
