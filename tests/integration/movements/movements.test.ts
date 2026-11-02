import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testDb, testEnv, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { dishData, itemLine } from "../../builders/recipe-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { getItem } from "../../../src/application/inventory/get-item";
import { listItems } from "../../../src/application/inventory/list-items";
import { setItemActive } from "../../../src/application/inventory/set-item-active";
import { updateItem } from "../../../src/application/inventory/update-item";
import { createRecipe, getRecipe } from "../../../src/application/inventory/recipes";
import {
  cancelAdjustment,
  decideAdjustment,
  listAdjustmentRequests,
  listMovements,
  registerLoss,
  registerPurchase,
  requestAdjustment,
  reverseMovement,
} from "../../../src/application/inventory/movements";
import type { RequestContext } from "../../../src/application/context";
import { reasonByCode } from "../../../src/domain/inventory/movement-reasons";
import { d } from "../../../src/domain/shared/decimal";
import { withTenantTx } from "../../../src/infra/db/db";

const BURNT = reasonByCode("LOSS", "BURNT")!.id;
const SHELF = reasonByCode("ADJUSTMENT", "SHELF_CHECK")!.id;
const WRONG = reasonByCode("REVERSAL", "WRONG_ENTRY")!.id;

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

let keySeq = 0;
const key = () => `k-${Date.now()}-${++keySeq}`;

/** Tomate em kg, comprado em caixa de 20 kg. */
async function tomato(env: TestEnv, ctx: RequestContext) {
  const sub = await subgroupId(env, ctx, "01", "02");
  return unwrap(await createItem(env.deps, ctx, itemData({ subgroupId: sub }))).id;
}

const buy = (
  env: TestEnv,
  ctx: RequestContext,
  itemId: string,
  quantity: string,
  unit: "kg" | "g" | "PACKAGE",
  totalPaid: string,
) =>
  registerPurchase(env.deps, ctx, {
    itemId,
    quantity: d(quantity),
    unit,
    totalPaid: d(totalPaid),
    occurredAt: env.clock.now(),
    notes: null,
    idempotencyKey: key(),
  });

const lose = (env: TestEnv, ctx: RequestContext, itemId: string, quantity: string, unit: "kg" | "g") =>
  registerLoss(env.deps, ctx, {
    itemId,
    quantity: d(quantity),
    unit,
    reasonId: BURNT,
    occurredAt: env.clock.now(),
    notes: "caiu no chão",
    idempotencyKey: key(),
  });

async function stock(env: TestEnv, ctx: RequestContext, itemId: string) {
  const v = unwrap(await getItem(env.deps, ctx, itemId));
  return {
    balance: v.balance.toString(),
    avg: v.item.averageCost?.toString() ?? null,
    last: v.item.lastCost?.toString() ?? null,
  };
}

async function ledgerSum(itemId: string) {
  const r = await ownerTestDb().$client.query<{ s: string }>(
    "select coalesce(sum(quantity), 0)::text as s from stock_movements where item_id = $1",
    [itemId],
  );
  const b = await ownerTestDb().$client.query<{ q: string }>(
    "select quantity::text as q from stock_balances where item_id = $1",
    [itemId],
  );
  return { ledger: d(r.rows[0]!.s).toString(), balance: b.rows[0] ? d(b.rows[0].q).toString() : "0" };
}

describe("compra (spec 004, US1)", () => {
  it("3 caixas de tomate por R$ 240: saldo 60 kg, custo R$ 4,00; depois 10 kg a R$ 30 mudam a média", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await tomato(env, ctx);
    unwrap(await buy(env, ctx, id, "3", "PACKAGE", "240"));
    expect(await stock(env, ctx, id)).toEqual({ balance: "60", avg: "4", last: "4" });

    unwrap(await buy(env, ctx, id, "10", "kg", "30"));
    expect(await stock(env, ctx, id)).toEqual({ balance: "70", avg: "3.8571", last: "3" });

    const list = unwrap(await listItems(env.deps, ctx, { page: 1 }));
    expect(list.rows[0]!.balance.toString()).toBe("70");
    expect(await ledgerSum(id)).toEqual({ ledger: "70", balance: "70" });
  });

  it("a primeira movimentação trava a medida do item", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await tomato(env, ctx);
    unwrap(await buy(env, ctx, id, "1", "kg", "5"));
    const sub = await subgroupId(env, ctx, "01", "02");
    const r = await updateItem(
      env.deps,
      ctx,
      id,
      1,
      itemData({ subgroupId: sub, stockUnit: "g", purchaseFactor: d(20000) }),
    );
    expect(code(r)).toBe("ITEM_UNIT_LOCKED");
  });

  it("mesmo formulário enviado duas vezes não lança em dobro", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await tomato(env, ctx);
    const input = {
      itemId: id,
      quantity: d(1),
      unit: "kg" as const,
      totalPaid: d(5),
      occurredAt: env.clock.now(),
      notes: null,
      idempotencyKey: "mesma-chave",
    };
    const a = unwrap(await registerPurchase(env.deps, ctx, input));
    const b = unwrap(await registerPurchase(env.deps, ctx, input));
    expect(b.movementId).toBe(a.movementId);
    expect((await stock(env, ctx, id)).balance).toBe("1");
  });

  it("o custo do produto aparece depois da compra (liga com a 003)", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await tomato(env, ctx);
    const recipe = unwrap(
      await createRecipe(env.deps, ctx, dishData({ name: "Salada", lines: [itemLine(id, "200", "g")] })),
    );
    expect(unwrap(await getRecipe(env.deps, ctx, recipe.id)).total).toBeNull();
    unwrap(await buy(env, ctx, id, "10", "kg", "50"));
    expect(unwrap(await getRecipe(env.deps, ctx, recipe.id)).total?.toString()).toBe("1");
  });

  it("item inativo não recebe compra", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await tomato(env, ctx);
    unwrap(await setItemActive(env.deps, ctx, id, 1, false));
    expect(code(await buy(env, ctx, id, "1", "kg", "5"))).toBe("ITEM_INACTIVE");
  });
});

describe("perda (spec 004, US2)", () => {
  it("500 g queimados saem pelo custo médio e aparecem nas movimentações com o motivo", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await tomato(env, ctx);
    unwrap(await buy(env, ctx, id, "10", "kg", "30"));
    unwrap(await lose(env, ctx, id, "500", "g"));
    expect(await stock(env, ctx, id)).toEqual({ balance: "9.5", avg: "3", last: "3" });

    const rows = unwrap(await listMovements(env.deps, ctx, { itemId: id }));
    expect(
      rows.map((r) => [r.type, r.quantity.toString(), r.totalCost.toString(), r.reasonLabel, r.notes]),
    ).toEqual([
      ["LOSS", "-0.5", "-1.5", "Queimou", "caiu no chão"],
      ["PURCHASE", "10", "30", null, null],
    ]);
    expect(rows[0]!.recordedByName).toBe("Gerente");
  });

  it("perda maior que o saldo é recusada", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await tomato(env, ctx);
    unwrap(await buy(env, ctx, id, "2", "kg", "6"));
    const r = await lose(env, ctx, id, "3", "kg");
    expect(code(r)).toBe("INSUFFICIENT_STOCK");
    expect((await stock(env, ctx, id)).balance).toBe("2");
  });

  it("duas perdas ao mesmo tempo não passam do saldo", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await tomato(env, ctx);
    unwrap(await buy(env, ctx, id, "5", "kg", "15"));
    const results = await Promise.all(Array.from({ length: 4 }, () => lose(env, ctx, id, "2", "kg")));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect((await stock(env, ctx, id)).balance).toBe("1");
    expect(await ledgerSum(id)).toEqual({ ledger: "1", balance: "1" });
  });
});

describe("acerto com aprovação (spec 004, US3)", () => {
  it("chef pede, o saldo não muda; o gerente aprova e a diferença entra no livro", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const chef = await addMember(env, manager, ["CHEF"], "Chef");
    const id = await tomato(env, manager);
    unwrap(await buy(env, manager, id, "10", "kg", "30"));

    const req = unwrap(
      await requestAdjustment(env.deps, chef, {
        itemId: id,
        countedQuantity: d(8),
        unit: "kg",
        reasonId: SHELF,
        notes: null,
      }),
    );
    expect(req.difference.toString()).toBe("-2");
    expect((await stock(env, manager, id)).balance).toBe("10");
    const pending = unwrap(await listAdjustmentRequests(env.deps, manager, { status: "PENDING" }));
    expect(pending.map((p) => [p.itemName, p.difference.toString(), p.requestedByName])).toEqual([
      ["Tomate italiano", "-2", "Chef"],
    ]);

    unwrap(await decideAdjustment(env.deps, manager, req.requestId, true, null));
    expect((await stock(env, manager, id)).balance).toBe("8");
    const rows = unwrap(await listMovements(env.deps, manager, { itemId: id, type: "ADJUSTMENT" }));
    expect(rows.map((r) => [r.quantity.toString(), r.recordedByName, r.approvedByName])).toEqual([
      ["-2", "Chef", "Gerente"],
    ]);
    expect(code(await decideAdjustment(env.deps, manager, req.requestId, false, null))).toBe(
      "REQUEST_NOT_PENDING",
    );
  });

  it("quem pediu não aprova, nem sendo gerente; chef não aprova", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const chef = await addMember(env, manager, ["CHEF"]);
    const id = await tomato(env, manager);
    unwrap(await buy(env, manager, id, "10", "kg", "30"));
    const own = unwrap(
      await requestAdjustment(env.deps, manager, {
        itemId: id,
        countedQuantity: d(9),
        unit: "kg",
        reasonId: SHELF,
        notes: null,
      }),
    );
    expect(code(await decideAdjustment(env.deps, manager, own.requestId, true, null))).toBe("SELF_APPROVAL");
    expect(code(await decideAdjustment(env.deps, chef, own.requestId, true, null))).toBe("FORBIDDEN");

    const other = await addMember(env, manager, ["MANAGER"], "Outro gerente");
    unwrap(await decideAdjustment(env.deps, other, own.requestId, true, null));
    expect((await stock(env, manager, id)).balance).toBe("9");

    await expect(
      ownerTestDb().$client.query("update adjustment_requests set decided_by = created_by"),
    ).rejects.toThrow();
  });

  it("recusar e cancelar não mudam o saldo; só quem pediu cancela", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const chef = await addMember(env, manager, ["CHEF"]);
    const id = await tomato(env, manager);
    unwrap(await buy(env, manager, id, "10", "kg", "30"));
    const a = unwrap(
      await requestAdjustment(env.deps, chef, {
        itemId: id,
        countedQuantity: d(5),
        unit: "kg",
        reasonId: SHELF,
        notes: null,
      }),
    );
    unwrap(await decideAdjustment(env.deps, manager, a.requestId, false, "contei de novo, está certo"));
    const b = unwrap(
      await requestAdjustment(env.deps, chef, {
        itemId: id,
        countedQuantity: d(5),
        unit: "kg",
        reasonId: SHELF,
        notes: null,
      }),
    );
    expect(code(await cancelAdjustment(env.deps, manager, b.requestId))).toBe("FORBIDDEN");
    unwrap(await cancelAdjustment(env.deps, chef, b.requestId));
    expect((await stock(env, manager, id)).balance).toBe("10");
    const all = unwrap(await listAdjustmentRequests(env.deps, manager, { status: "ALL" }));
    expect(all.map((r) => r.status).sort()).toEqual(["CANCELLED", "REJECTED"]);
  });

  it("aprovar falta maior que o saldo atual é recusado", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const chef = await addMember(env, manager, ["CHEF"]);
    const id = await tomato(env, manager);
    unwrap(await buy(env, manager, id, "10", "kg", "30"));
    const req = unwrap(
      await requestAdjustment(env.deps, chef, {
        itemId: id,
        countedQuantity: d(2),
        unit: "kg",
        reasonId: SHELF,
        notes: null,
      }),
    );
    unwrap(await lose(env, manager, id, "5", "kg"));
    expect(code(await decideAdjustment(env.deps, manager, req.requestId, true, null))).toBe(
      "INSUFFICIENT_STOCK",
    );
  });
});

describe("estorno (spec 004, US5)", () => {
  it("estorno de compra devolve o saldo e a média; não estorna duas vezes", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await tomato(env, ctx);
    unwrap(await buy(env, ctx, id, "10", "kg", "30"));
    const wrong = unwrap(await buy(env, ctx, id, "60", "kg", "240"));
    expect((await stock(env, ctx, id)).avg).toBe("3.8571");

    unwrap(
      await reverseMovement(env.deps, ctx, wrong.movementId, {
        reasonId: WRONG,
        notes: null,
        idempotencyKey: key(),
      }),
    );
    expect(await stock(env, ctx, id)).toMatchObject({ balance: "10", avg: "3" });
    const again = await reverseMovement(env.deps, ctx, wrong.movementId, {
      reasonId: WRONG,
      notes: null,
      idempotencyKey: key(),
    });
    expect(code(again)).toBe("ALREADY_REVERSED");

    const rows = unwrap(await listMovements(env.deps, ctx, { itemId: id }));
    expect(rows.find((r) => r.id === wrong.movementId)?.reversedById).toBeTruthy();
    expect(await ledgerSum(id)).toEqual({ ledger: "10", balance: "10" });
  });

  it("estorno que deixaria saldo negativo é recusado; só gerente estorna", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const stockkeeper = await addMember(env, ctx, ["STOCKKEEPER"]);
    const id = await tomato(env, ctx);
    const p = unwrap(await buy(env, stockkeeper, id, "10", "kg", "30"));
    unwrap(await lose(env, stockkeeper, id, "8", "kg"));
    expect(
      code(
        await reverseMovement(env.deps, ctx, p.movementId, {
          reasonId: WRONG,
          notes: null,
          idempotencyKey: key(),
        }),
      ),
    ).toBe("INSUFFICIENT_STOCK");
    expect(
      code(
        await reverseMovement(env.deps, stockkeeper, p.movementId, {
          reasonId: WRONG,
          notes: null,
          idempotencyKey: key(),
        }),
      ),
    ).toBe("FORBIDDEN");
  });
});

describe("livro imutável e segurança (constituição III e V)", () => {
  it("movimentação não muda nem some, nem pela aplicação nem pelo dono", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await tomato(env, ctx);
    unwrap(await buy(env, ctx, id, "1", "kg", "5"));
    for (const stmt of ["update stock_movements set quantity = 2", "delete from stock_movements"]) {
      await expect(
        withTenantTx(testDb(), ctx.restaurantId, (tx) => tx.execute(sql.raw(stmt))),
        stmt,
      ).rejects.toThrow();
      await expect(ownerTestDb().$client.query(stmt), `${stmt} (dono)`).rejects.toThrow(/APPEND_ONLY/);
    }
  });

  it("administrativo não lança; restaurante B não vê nem lança no item de A", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    const admin = await addMember(env, a, ["ADMINISTRATIVE"]);
    const id = await tomato(env, a);
    expect(code(await buy(env, admin, id, "1", "kg", "5"))).toBe("FORBIDDEN");
    unwrap(await buy(env, a, id, "1", "kg", "5"));
    expect(code(await buy(env, b, id, "1", "kg", "5"))).toBe("NOT_FOUND");
    expect(unwrap(await listMovements(env.deps, b, {}))).toEqual([]);
  });

  it("propriedade: depois de uma sequência qualquer de lançamentos, saldo = soma do livro", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await tomato(env, ctx);
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const done: string[] = [];
    for (let i = 0; i < 25; i++) {
      const pick = rand();
      if (pick < 0.45) {
        const r = await buy(
          env,
          ctx,
          id,
          String(1 + Math.floor(rand() * 9)),
          "kg",
          String(Math.floor(rand() * 50)),
        );
        if (r.ok) done.push(r.value.movementId);
      } else if (pick < 0.8) {
        await lose(env, ctx, id, String(100 + Math.floor(rand() * 3000)), "g");
      } else if (done.length) {
        const m = done.splice(Math.floor(rand() * done.length), 1)[0]!;
        await reverseMovement(env.deps, ctx, m, { reasonId: WRONG, notes: null, idempotencyKey: key() });
      }
      const s = await ledgerSum(id);
      expect(s.balance, `passo ${i}`).toBe(s.ledger);
      expect(d(s.balance).gte(0)).toBe(true);
    }
  });
});
