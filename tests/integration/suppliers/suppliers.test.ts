import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testEnv, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { supplierData, supplierItemData } from "../../builders/supplier-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { getItem } from "../../../src/application/inventory/get-item";
import { setItemActive } from "../../../src/application/inventory/set-item-active";
import {
  listMovements,
  movementItemOptions,
  registerPurchase,
} from "../../../src/application/inventory/movements";
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
import { getAuditHistory } from "../../../src/application/audit/get-audit-history";
import type { RequestContext } from "../../../src/application/context";
import { d } from "../../../src/domain/shared/decimal";

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

let keySeq = 0;
const key = () => `s-${Date.now()}-${++keySeq}`;

async function tomato(env: TestEnv, ctx: RequestContext, description = "Tomate italiano") {
  const sub = await subgroupId(env, ctx, "01", "02");
  return unwrap(await createItem(env.deps, ctx, itemData({ subgroupId: sub, description }))).id;
}

const purchase = (
  env: TestEnv,
  ctx: RequestContext,
  over: { itemId: string; supplierId: string | null; unit?: "kg" | "PACKAGE" | "SUPPLIER_PACKAGE" },
) =>
  registerPurchase(env.deps, ctx, {
    itemId: over.itemId,
    supplierId: over.supplierId,
    quantity: d(2),
    unit: over.unit ?? "kg",
    totalPaid: d(180),
    occurredAt: env.clock.now(),
    notes: null,
    idempotencyKey: key(),
  });

describe("cadastro do fornecedor (spec 007, US1)", () => {
  it("cria só com o nome e depois completa com CNPJ, contato e entrega", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const { id } = unwrap(await createSupplier(env.deps, ctx, supplierData()));

    const r = unwrap(
      await updateSupplier(
        env.deps,
        ctx,
        id,
        1,
        supplierData({
          cnpj: "11.222.333/0001-81",
          contactName: "João",
          phone: "(11) 99999-0000",
          email: "joao@horti.com.br",
          deliveryDays: [5, 2],
          leadTimeDays: 1,
          minOrderValue: d("150"),
          paymentTerms: "Boleto 28 dias",
        }),
      ),
    );
    expect(r.version).toBe(2);

    const v = unwrap(await getSupplier(env.deps, ctx, id));
    expect(v.supplier).toMatchObject({
      name: "Hortifruti do João",
      cnpj: "11222333000181",
      deliveryDays: [2, 5],
      leadTimeDays: 1,
      paymentTerms: "Boleto 28 dias",
      active: true,
      version: 2,
    });
    expect(v.supplier.minOrderValue?.toString()).toBe("150");
  });

  it("aceita CNPJ alfanumérico", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const { id } = unwrap(await createSupplier(env.deps, ctx, supplierData({ cnpj: "12.ABC.345/01DE-35" })));
    expect(unwrap(await getSupplier(env.deps, ctx, id)).supplier.cnpj).toBe("12ABC34501DE35");
  });

  it("CNPJ repetido no restaurante é recusado e diz quem já usa; em outro restaurante pode", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    unwrap(await createSupplier(env.deps, ctx, supplierData({ cnpj: "11222333000181" })));
    const dup = await createSupplier(
      env.deps,
      ctx,
      supplierData({ name: "Outro nome", cnpj: "11.222.333/0001-81" }),
    );
    expect(code(dup)).toBe("CNPJ_IN_USE");
    expect(dup.ok ? null : dup.error.details?.existingName).toBe("Hortifruti do João");

    const other = await newRestaurant(env, "Outro Restaurante");
    expect(code(await createSupplier(env.deps, other, supplierData({ cnpj: "11222333000181" })))).toBe("OK");
  });

  it("nome repetido entre ativos é recusado, ignorando acento e caixa", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    unwrap(await createSupplier(env.deps, ctx, supplierData()));
    expect(code(await createSupplier(env.deps, ctx, supplierData({ name: "HORTIFRUTI DO JOAO" })))).toBe(
      "NAME_IN_USE",
    );
  });

  it("edição com versão antiga devolve STALE_RECORD", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const { id } = unwrap(await createSupplier(env.deps, ctx, supplierData()));
    unwrap(await updateSupplier(env.deps, ctx, id, 1, supplierData({ phone: "1" })));
    expect(code(await updateSupplier(env.deps, ctx, id, 1, supplierData({ phone: "2" })))).toBe(
      "STALE_RECORD",
    );
  });

  it("lista com busca por nome ou CNPJ e filtro de bloqueados", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    unwrap(await createSupplier(env.deps, ctx, supplierData()));
    const boi = unwrap(
      await createSupplier(env.deps, ctx, supplierData({ name: "Açougue Boi Bom", cnpj: "11444777000161" })),
    );
    unwrap(await setSupplierActive(env.deps, ctx, boi.id, 1, false));

    const names = async (f: Parameters<typeof listSuppliers>[2]) =>
      unwrap(await listSuppliers(env.deps, ctx, f)).map((s) => s.name);
    expect(await names({})).toEqual(["Hortifruti do João"]);
    expect(await names({ status: "blocked" })).toEqual(["Açougue Boi Bom"]);
    expect(await names({ status: "all", q: "acougue" })).toEqual(["Açougue Boi Bom"]);
    expect(await names({ status: "all", q: "11.444" })).toEqual(["Açougue Boi Bom"]);
  });
});

describe("o que cada fornecedor vende (spec 007, US2 e US3)", () => {
  it("adiciona item com caixa, mostra preço por medida e não repete o item", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const item = await tomato(env, ctx);
    const s = unwrap(await createSupplier(env.deps, ctx, supplierData()));
    unwrap(await addSupplierItem(env.deps, ctx, s.id, supplierItemData(item)));
    expect(code(await addSupplierItem(env.deps, ctx, s.id, supplierItemData(item)))).toBe(
      "SUPPLIER_ITEM_DUPLICATE",
    );

    const v = unwrap(await getSupplier(env.deps, ctx, s.id));
    expect(v.items).toHaveLength(1);
    expect(v.items[0]).toMatchObject({ itemName: "Tomate italiano", packageLabel: "Caixa", stockUnit: "kg" });
    expect(v.items[0]!.pricePerUnit.toString()).toBe("5");
  });

  it("item inativo não entra na lista do fornecedor", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const item = await tomato(env, ctx);
    unwrap(await setItemActive(env.deps, ctx, item, 1, false));
    const s = unwrap(await createSupplier(env.deps, ctx, supplierData()));
    expect(code(await addSupplierItem(env.deps, ctx, s.id, supplierItemData(item)))).toBe("ITEM_INACTIVE");
  });

  it("um preferido por item: marcar outro tira a marca do anterior", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const item = await tomato(env, ctx);
    const a = unwrap(await createSupplier(env.deps, ctx, supplierData({ name: "Fornecedor A" })));
    const b = unwrap(await createSupplier(env.deps, ctx, supplierData({ name: "Fornecedor B" })));
    unwrap(await addSupplierItem(env.deps, ctx, a.id, supplierItemData(item, { preferred: true })));
    const bi = unwrap(
      await addSupplierItem(
        env.deps,
        ctx,
        b.id,
        supplierItemData(item, { packageLabel: null, packageQuantity: null, price: d("4.8") }),
      ),
    );

    let offers = unwrap(await listItemOffers(env.deps, ctx, item));
    expect(offers.map((o) => [o.supplierName, o.preferred, o.cheapest])).toEqual([
      ["Fornecedor A", true, false],
      ["Fornecedor B", false, true],
    ]);

    unwrap(
      await updateSupplierItem(env.deps, ctx, bi.id, 1, {
        packageLabel: null,
        packageQuantity: null,
        price: d("4.8"),
        preferred: true,
      }),
    );
    offers = unwrap(await listItemOffers(env.deps, ctx, item));
    expect(offers.map((o) => [o.supplierName, o.preferred])).toEqual([
      ["Fornecedor A", false],
      ["Fornecedor B", true],
    ]);
  });

  it("o banco não deixa dois preferidos para o mesmo item", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const item = await tomato(env, ctx);
    const a = unwrap(await createSupplier(env.deps, ctx, supplierData({ name: "Fornecedor A" })));
    const b = unwrap(await createSupplier(env.deps, ctx, supplierData({ name: "Fornecedor B" })));
    unwrap(await addSupplierItem(env.deps, ctx, a.id, supplierItemData(item, { preferred: true })));
    const bi = unwrap(await addSupplierItem(env.deps, ctx, b.id, supplierItemData(item)));
    await expect(
      ownerTestDb().$client.query("update supplier_items set preferred = true where id = $1", [bi.id]),
    ).rejects.toThrow(/supplier_items_preferred/);
  });

  it("edita preço e embalagem, remove o item e registra tudo na auditoria", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const item = await tomato(env, ctx);
    const s = unwrap(await createSupplier(env.deps, ctx, supplierData()));
    const si = unwrap(await addSupplierItem(env.deps, ctx, s.id, supplierItemData(item)));
    unwrap(
      await updateSupplierItem(env.deps, ctx, si.id, 1, {
        packageLabel: "Caixa",
        packageQuantity: d(20),
        price: d(110),
        preferred: false,
      }),
    );
    expect(code(await updateSupplierItem(env.deps, ctx, si.id, 1, supplierItemData(item)))).toBe(
      "STALE_RECORD",
    );
    let v = unwrap(await getSupplier(env.deps, ctx, s.id));
    expect(v.items[0]!.pricePerUnit.toString()).toBe("5.5");

    unwrap(await removeSupplierItem(env.deps, ctx, si.id));
    v = unwrap(await getSupplier(env.deps, ctx, s.id));
    expect(v.items).toHaveLength(0);

    const history = unwrap(await getAuditHistory(env.deps, ctx, "supplier", s.id));
    expect(history.map((h) => h.action)).toEqual(["CREATE", "UPDATE", "UPDATE", "UPDATE"]);
  });
});

describe("compra com fornecedor (spec 007, US4 e US5)", () => {
  it("compra de 2 caixas de 18 kg do fornecedor: entram 36 kg e a compra mostra o fornecedor", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const item = await tomato(env, ctx);
    const s = unwrap(await createSupplier(env.deps, ctx, supplierData()));
    unwrap(await addSupplierItem(env.deps, ctx, s.id, supplierItemData(item)));

    unwrap(await purchase(env, ctx, { itemId: item, supplierId: s.id, unit: "SUPPLIER_PACKAGE" }));
    const view = unwrap(await getItem(env.deps, ctx, item));
    expect(view.balance.toString()).toBe("36");
    expect(view.item.lastCost?.toString()).toBe("5");

    const [m] = unwrap(await listMovements(env.deps, ctx, { itemId: item }));
    expect(m).toMatchObject({ supplierId: s.id, supplierName: "Hortifruti do João", enteredUnit: "Caixa" });

    const offer = unwrap(await getSupplier(env.deps, ctx, s.id)).items[0]!;
    expect(offer.price.toString()).toBe("90");
    expect(offer.lastPurchase?.unitCost.toString()).toBe("5");
  });

  it("embalagem do fornecedor sem fornecedor ou sem embalagem cadastrada é recusada", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const item = await tomato(env, ctx);
    const s = unwrap(await createSupplier(env.deps, ctx, supplierData()));
    expect(code(await purchase(env, ctx, { itemId: item, supplierId: null, unit: "SUPPLIER_PACKAGE" }))).toBe(
      "UNKNOWN_UNIT",
    );
    expect(code(await purchase(env, ctx, { itemId: item, supplierId: s.id, unit: "SUPPLIER_PACKAGE" }))).toBe(
      "UNKNOWN_UNIT",
    );
  });

  it("fornecedor bloqueado não recebe compra e some das opções; desbloqueado volta", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const item = await tomato(env, ctx);
    const s = unwrap(await createSupplier(env.deps, ctx, supplierData()));
    unwrap(await addSupplierItem(env.deps, ctx, s.id, supplierItemData(item)));
    unwrap(await setSupplierActive(env.deps, ctx, s.id, 1, false));

    expect(code(await purchase(env, ctx, { itemId: item, supplierId: s.id }))).toBe("SUPPLIER_BLOCKED");
    expect(unwrap(await purchaseSupplierOptions(env.deps, ctx))).toEqual([]);

    unwrap(await setSupplierActive(env.deps, ctx, s.id, 2, true));
    const options = unwrap(await purchaseSupplierOptions(env.deps, ctx));
    expect(options).toHaveLength(1);
    expect(options[0]!.packages[0]).toMatchObject({ itemId: item, packageLabel: "Caixa" });
    expect(code(await purchase(env, ctx, { itemId: item, supplierId: s.id }))).toBe("OK");
  });

  it("fornecedor de outro restaurante não é encontrado", async () => {
    const env = testEnv();
    const a = await newRestaurant(env);
    const b = await newRestaurant(env, "Outro Restaurante");
    const s = unwrap(await createSupplier(env.deps, a, supplierData()));
    const item = await tomato(env, b);
    expect(code(await getSupplier(env.deps, b, s.id))).toBe("NOT_FOUND");
    expect(code(await purchase(env, b, { itemId: item, supplierId: s.id }))).toBe("NOT_FOUND");
  });

  it("o banco só aceita fornecedor na compra", async () => {
    const r = await ownerTestDb().$client.query<{ def: string }>(
      "select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'stock_movements_supplier_purchase'",
    );
    expect(r.rows[0]?.def).toMatch(/PURCHASE/);
  });
});

describe("permissões e auditoria (spec 007, FR-006, FR-008)", () => {
  it("comprador cadastra; chef e estoquista só veem; negado vai para a auditoria", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const buyer = await addMember(env, manager, ["BUYER"]);
    const chef = await addMember(env, manager, ["CHEF"]);
    const stock = await addMember(env, manager, ["STOCKKEEPER"]);

    const s = unwrap(await createSupplier(env.deps, buyer, supplierData()));
    expect(code(await createSupplier(env.deps, chef, supplierData({ name: "Outro" })))).toBe("FORBIDDEN");
    expect(code(await setSupplierActive(env.deps, stock, s.id, 1, false))).toBe("FORBIDDEN");
    expect(code(await getSupplier(env.deps, chef, s.id))).toBe("OK");
    expect(code(await listSuppliers(env.deps, stock, {}))).toBe("OK");

    const denied = await ownerTestDb().$client.query(
      "select 1 from audit_log where entity = 'supplier' and action = 'DENIED' and restaurant_id = $1",
      [manager.restaurantId],
    );
    expect(denied.rowCount).toBe(2);
  });

  it("bloquear e desbloquear ficam no histórico", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const s = unwrap(await createSupplier(env.deps, ctx, supplierData()));
    unwrap(await setSupplierActive(env.deps, ctx, s.id, 1, false));
    unwrap(await setSupplierActive(env.deps, ctx, s.id, 2, true));
    const history = unwrap(await getAuditHistory(env.deps, ctx, "supplier", s.id));
    expect(history.map((h) => h.action)).toEqual(["CREATE", "DEACTIVATE", "REACTIVATE"]);
  });
});

describe("opções da tela de lançamento", () => {
  it("oferece todos os itens ativos, não só os 50 da primeira página da lista", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const sub = await subgroupId(env, ctx, "01", "02");
    for (let i = 1; i <= 51; i++)
      unwrap(await createItem(env.deps, ctx, itemData({ subgroupId: sub, description: `Item ${i}` })));
    const options = unwrap(await movementItemOptions(env.deps, ctx));
    expect(options).toHaveLength(51);
    expect(options[0]).toMatchObject({ stockUnit: "kg", purchaseUnitLabel: "Caixa" });
  });
});
