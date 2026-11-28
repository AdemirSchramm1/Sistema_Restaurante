import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testEnv, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { supplierData, supplierItemData } from "../../builders/supplier-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { setItemActive } from "../../../src/application/inventory/set-item-active";
import {
  addSupplierItem,
  createSupplier,
  getSupplier,
  listItemOffers,
  listSuppliers,
  purchaseSupplierOptions,
  removeSupplierItem,
  setSupplierActive,
  updateSupplier,
  updateSupplierItem,
} from "../../../src/application/suppliers/suppliers";
import { d } from "../../../src/domain/shared/decimal";
import { ok, type Result } from "../../../src/domain/shared/result";

/** Spec 018, US3: recusas e casos do cadastro de fornecedores (docs/produto/estoque/03) que faltavam. */

const db = () => ownerTestDb().$client;
const fail = (r: Result<unknown>) => (r.ok ? "OK" : `${r.error.code}@${r.error.field ?? ""}`);
const value = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
};
const MISSING = "00000000-0000-4000-8000-000000000000";
const auditOf = async (id: string) =>
  (
    await db().query(
      "select action, changes from audit_log where entity = 'supplier' and entity_id = $1 and action <> 'DENIED' order by occurred_at, id",
      [id],
    )
  ).rows;

async function setup(env: TestEnv) {
  const m = await newRestaurant(env);
  const chef = await addMember(env, m, ["CHEF"]);
  const waiter = await addMember(env, m, ["WAITER"]);
  const sub = await subgroupId(env, m, "01", "02");
  const tomato = value(await createItem(env.deps, m, itemData({ subgroupId: sub }))).id;
  const s = value(await createSupplier(env.deps, m, supplierData())).id;
  return { m, chef, waiter, sub, tomato, s };
}

describe("cadastro do fornecedor: recusas (spec 007, US1)", () => {
  it("quem não cadastra fornecedor recebe FORBIDDEN em toda escrita", async () => {
    const env = testEnv();
    const { m, chef, tomato, s } = await setup(env);
    const offer = value(await addSupplierItem(env.deps, m, s, supplierItemData(tomato))).id;
    expect(fail(await updateSupplier(env.deps, chef, s, 1, supplierData()))).toBe("FORBIDDEN@");
    expect(fail(await addSupplierItem(env.deps, chef, s, supplierItemData(tomato)))).toBe("FORBIDDEN@");
    expect(fail(await updateSupplierItem(env.deps, chef, offer, 1, supplierItemData(tomato)))).toBe(
      "FORBIDDEN@",
    );
    expect(fail(await removeSupplierItem(env.deps, chef, offer))).toBe("FORBIDDEN@");
  });

  it("quem não vê o catálogo recebe FORBIDDEN nas leituras", async () => {
    const env = testEnv();
    const { waiter, tomato, s } = await setup(env);
    expect(fail(await getSupplier(env.deps, waiter, s))).toBe("FORBIDDEN@");
    expect(fail(await listSuppliers(env.deps, waiter, {}))).toBe("FORBIDDEN@");
    expect(fail(await listItemOffers(env.deps, waiter, tomato))).toBe("FORBIDDEN@");
    expect(fail(await purchaseSupplierOptions(env.deps, waiter))).toBe("FORBIDDEN@");
  });

  it("nome curto é INVALID_NAME ao criar e ao editar", async () => {
    const env = testEnv();
    const { m, s } = await setup(env);
    expect(fail(await createSupplier(env.deps, m, supplierData({ name: "A" })))).toBe("INVALID_NAME@name");
    expect(fail(await updateSupplier(env.deps, m, s, 1, supplierData({ name: "A" })))).toBe(
      "INVALID_NAME@name",
    );
  });

  it("fornecedor que não existe é NOT_FOUND", async () => {
    const env = testEnv();
    const { m, tomato } = await setup(env);
    expect(fail(await updateSupplier(env.deps, m, MISSING, 1, supplierData()))).toBe("NOT_FOUND@");
    expect(fail(await setSupplierActive(env.deps, m, MISSING, 1, false))).toBe("NOT_FOUND@");
    expect(fail(await getSupplier(env.deps, m, MISSING))).toBe("NOT_FOUND@");
    expect(fail(await addSupplierItem(env.deps, m, MISSING, supplierItemData(tomato)))).toBe("NOT_FOUND@");
  });

  it("CNPJ de outro fornecedor na edição é recusado mesmo bloqueado, e diz quem usa", async () => {
    const env = testEnv();
    const { m, s } = await setup(env);
    value(await createSupplier(env.deps, m, supplierData({ name: "Ceasa", cnpj: "11222333000181" })));
    value(await setSupplierActive(env.deps, m, s, 1, false));
    const r = await updateSupplier(env.deps, m, s, 2, supplierData({ cnpj: "11222333000181" }));
    expect(fail(r)).toBe("CNPJ_IN_USE@cnpj");
    expect(r.ok ? null : r.error.details?.existingName).toBe("Ceasa");
  });

  it("nome repetido: ativo recusa na edição; bloqueado pode ter o mesmo nome, mas não desbloqueia", async () => {
    const env = testEnv();
    const { m } = await setup(env);
    const other = value(await createSupplier(env.deps, m, supplierData({ name: "Ceasa" }))).id;
    expect(fail(await updateSupplier(env.deps, m, other, 1, supplierData()))).toBe("NAME_IN_USE@name");

    value(await setSupplierActive(env.deps, m, other, 1, false));
    expect(
      fail(await updateSupplier(env.deps, m, other, 2, supplierData({ name: "HORTIFRUTI do joão" }))),
    ).toBe("OK");
    expect(fail(await setSupplierActive(env.deps, m, other, 3, true))).toBe("NAME_IN_USE@name");
    // A recusa não deixa rastro: nada gravado, versão igual.
    expect((await auditOf(other)).map((a) => a.action)).toEqual(["CREATE", "DEACTIVATE", "UPDATE"]);
    expect(fail(await setSupplierActive(env.deps, m, other, 2, true))).toBe("STALE_RECORD@");
  });

  it("editar sem mudar nada não grava auditoria", async () => {
    const env = testEnv();
    const { m, s } = await setup(env);
    expect(value(await updateSupplier(env.deps, m, s, 1, supplierData()))).toEqual({ version: 2 });
    expect((await auditOf(s)).map((a) => a.action)).toEqual(["CREATE"]);
  });

  it("erro do banco que não é repetição sobe como erro", async () => {
    const env = testEnv();
    const { m } = await setup(env);
    await expect(
      env.deps.tenant(m.restaurantId, async (repos) =>
        ok(
          await repos.suppliers.insert(
            { ...supplierData({ name: "Prazo" }), id: "x", nameNormalized: "prazo" },
            { at: env.clock.now(), by: m.userId },
          ),
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("itens do fornecedor: recusas (spec 007, US2)", () => {
  it("item inválido, inexistente, inativo ou repetido é recusado", async () => {
    const env = testEnv();
    const { m, sub, tomato, s } = await setup(env);
    expect(fail(await addSupplierItem(env.deps, m, s, supplierItemData(tomato, { price: d(0) })))).toBe(
      "INVALID_PRICE@price",
    );
    expect(fail(await addSupplierItem(env.deps, m, s, supplierItemData(MISSING)))).toBe("NOT_FOUND@itemId");
    const onion = value(
      await createItem(env.deps, m, itemData({ subgroupId: sub, description: "Cebola" })),
    ).id;
    value(await setItemActive(env.deps, m, onion, 1, false));
    expect(fail(await addSupplierItem(env.deps, m, s, supplierItemData(onion)))).toBe("ITEM_INACTIVE@itemId");

    value(await addSupplierItem(env.deps, m, s, supplierItemData(tomato)));
    expect(fail(await addSupplierItem(env.deps, m, s, supplierItemData(tomato, { preferred: true })))).toBe(
      "SUPPLIER_ITEM_DUPLICATE@itemId",
    );
    // A recusa desfaz tudo: o item continua sem preferido e com uma oferta só.
    const offers = value(await listItemOffers(env.deps, m, tomato));
    expect(offers.map((o) => o.preferred)).toEqual([false]);
  });

  it("editar: inexistente, versão velha ou inválido é recusado", async () => {
    const env = testEnv();
    const { m, tomato, s } = await setup(env);
    const offer = value(await addSupplierItem(env.deps, m, s, supplierItemData(tomato))).id;
    expect(fail(await updateSupplierItem(env.deps, m, MISSING, 1, supplierItemData(tomato)))).toBe(
      "NOT_FOUND@",
    );
    expect(
      fail(await updateSupplierItem(env.deps, m, offer, 1, supplierItemData(tomato, { price: d(-1) }))),
    ).toBe("INVALID_PRICE@price");
    value(await updateSupplierItem(env.deps, m, offer, 1, supplierItemData(tomato, { price: d(95) })));
    expect(
      fail(await updateSupplierItem(env.deps, m, offer, 1, supplierItemData(tomato, { preferred: true }))),
    ).toBe("STALE_RECORD@");
    expect(value(await listItemOffers(env.deps, m, tomato))[0]!.preferred).toBe(false);
  });

  it("editar sem mudar o texto não grava auditoria; manter preferido não mexe nos outros", async () => {
    const env = testEnv();
    const { m, tomato, s } = await setup(env);
    const offer = value(
      await addSupplierItem(env.deps, m, s, supplierItemData(tomato, { preferred: true })),
    ).id;
    const before = (await auditOf(s)).length;
    expect(
      value(await updateSupplierItem(env.deps, m, offer, 1, supplierItemData(tomato, { preferred: true }))),
    ).toEqual({ version: 2 });
    expect((await auditOf(s)).length).toBe(before);
    expect(value(await listItemOffers(env.deps, m, tomato))[0]!.preferred).toBe(true);
  });

  it("remover item que não existe é NOT_FOUND", async () => {
    const env = testEnv();
    const { m } = await setup(env);
    expect(fail(await removeSupplierItem(env.deps, m, MISSING))).toBe("NOT_FOUND@");
  });
});

describe("listas do fornecedor (spec 007, US1 e US4)", () => {
  it("todos sem busca; busca com espaço procura só no nome; sem embalagem vem sem opções", async () => {
    const env = testEnv();
    const { m, s } = await setup(env);
    const other = value(await createSupplier(env.deps, m, supplierData({ name: "Ceasa Sul" }))).id;
    value(await setSupplierActive(env.deps, m, other, 1, false));
    expect(value(await listSuppliers(env.deps, m, { status: "all" })).map((r) => r.name)).toEqual([
      "Ceasa Sul",
      "Hortifruti do João",
    ]);
    expect(value(await listSuppliers(env.deps, m, { status: "all", q: "c" })).map((r) => r.id)).toEqual([
      other,
    ]);
    expect(value(await purchaseSupplierOptions(env.deps, m))).toEqual([
      { id: s, name: "Hortifruti do João", packages: [] },
    ]);
  });
});
