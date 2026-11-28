import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, subgroupId, testEnv, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import {
  cancelAdjustment,
  decideAdjustment,
  listAdjustmentRequests,
  listMovements,
  movementItemOptions,
  registerLoss,
  registerPurchase,
  requestAdjustment,
  reverseMovement,
} from "../../../src/application/inventory/movements";
import { setItemActive } from "../../../src/application/inventory/set-item-active";
import { reasonByCode } from "../../../src/domain/inventory/movement-reasons";
import { d } from "../../../src/domain/shared/decimal";
import type { Result } from "../../../src/domain/shared/result";

/** Spec 018, US2: recusas dos lançamentos de estoque (docs/produto/estoque/06) que faltavam. */

const BURNT = reasonByCode("LOSS", "BURNT")!.id;
const SHELF = reasonByCode("ADJUSTMENT", "SHELF_CHECK")!.id;
const WRONG = reasonByCode("REVERSAL", "WRONG_ENTRY")!.id;
const code = (r: Result<unknown>) => (r.ok ? "OK" : r.error.code);
const fail = (r: Result<unknown>) => (r.ok ? "OK" : `${r.error.code}@${r.error.field ?? ""}`);
const value = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
};

async function setup(env: TestEnv) {
  const m = await newRestaurant(env);
  const waiter = await addMember(env, m, ["WAITER"], "Garçom");
  const chef = await addMember(env, m, ["CHEF"], "Chef");
  const sub = await subgroupId(env, m, "01", "02");
  const tomato = value(await createItem(env.deps, m, itemData({ subgroupId: sub }))).id;
  const onion = value(await createItem(env.deps, m, itemData({ subgroupId: sub, description: "Cebola" }))).id;
  value(await setItemActive(env.deps, m, onion, 1, false));
  const bought = value(
    await registerPurchase(env.deps, m, {
      itemId: tomato,
      quantity: d(10),
      unit: "kg",
      totalPaid: d(30),
      occurredAt: env.clock.now(),
      notes: null,
      idempotencyKey: null,
    }),
  );
  return { m, waiter, chef, tomato, onion, bought };
}

const loss = (itemId: string, idempotencyKey: string | null = null, occurredAt = new Date(0)) => ({
  itemId,
  quantity: d(1),
  unit: "kg" as const,
  reasonId: BURNT,
  occurredAt,
  notes: null,
  idempotencyKey,
});
const count = (itemId: string, reasonId = SHELF) => ({
  itemId,
  countedQuantity: d(8),
  unit: "kg" as const,
  reasonId,
  notes: null,
});

describe("perda, acerto e estorno: recusas (spec 004, US2 a US5)", () => {
  it("garçom não lança, não pede acerto, não estorna e não vê o livro", async () => {
    const env = testEnv();
    const t = await setup(env);
    expect(code(await registerLoss(env.deps, t.waiter, loss(t.tomato, null, env.clock.now())))).toBe(
      "FORBIDDEN",
    );
    expect(code(await requestAdjustment(env.deps, t.waiter, count(t.tomato)))).toBe("FORBIDDEN");
    expect(code(await cancelAdjustment(env.deps, t.waiter, crypto.randomUUID()))).toBe("FORBIDDEN");
    expect(
      code(
        await reverseMovement(env.deps, t.waiter, t.bought.movementId, {
          reasonId: WRONG,
          notes: null,
          idempotencyKey: null,
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(code(await listMovements(env.deps, t.waiter, {}))).toBe("FORBIDDEN");
    expect(code(await listAdjustmentRequests(env.deps, t.waiter, { status: "ALL" }))).toBe("FORBIDDEN");
    expect(code(await movementItemOptions(env.deps, t.waiter))).toBe("FORBIDDEN");
  });

  it("item que não existe: perda e acerto dizem no campo itemId", async () => {
    const env = testEnv();
    const t = await setup(env);
    expect(fail(await registerLoss(env.deps, t.m, loss(crypto.randomUUID(), null, env.clock.now())))).toBe(
      "NOT_FOUND@itemId",
    );
    expect(fail(await requestAdjustment(env.deps, t.m, count(crypto.randomUUID())))).toBe("NOT_FOUND@itemId");
  });

  it("perda e estorno enviados duas vezes (mesma chave) lançam uma vez só", async () => {
    const env = testEnv();
    const t = await setup(env);
    const a = value(await registerLoss(env.deps, t.m, loss(t.tomato, "perda-1", env.clock.now())));
    expect(value(await registerLoss(env.deps, t.m, loss(t.tomato, "perda-1", env.clock.now())))).toEqual(a);
    const cmd = { reasonId: WRONG, notes: null, idempotencyKey: "estorno-1" };
    const r = value(await reverseMovement(env.deps, t.m, a.movementId, cmd));
    expect(value(await reverseMovement(env.deps, t.m, a.movementId, cmd))).toEqual(r);
    expect(
      value(await listMovements(env.deps, t.m, { itemId: t.tomato }))
        .map((x) => x.type)
        .sort(),
    ).toEqual(["LOSS", "PURCHASE", "REVERSAL"]);
  });

  it("estorno de movimentação que não existe é NOT_FOUND", async () => {
    const env = testEnv();
    const t = await setup(env);
    expect(
      code(
        await reverseMovement(env.deps, t.m, crypto.randomUUID(), {
          reasonId: WRONG,
          notes: null,
          idempotencyKey: null,
        }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("acerto com motivo de outro tipo é recusado no campo reasonId", async () => {
    const env = testEnv();
    const t = await setup(env);
    expect(fail(await requestAdjustment(env.deps, t.m, count(t.tomato, BURNT)))).toMatch(/@reasonId$/);
  });

  it("decidir ou cancelar pedido que não existe é NOT_FOUND; cancelar pedido já recusado também não vale", async () => {
    const env = testEnv();
    const t = await setup(env);
    expect(code(await decideAdjustment(env.deps, t.m, crypto.randomUUID(), true, null))).toBe("NOT_FOUND");
    expect(code(await cancelAdjustment(env.deps, t.chef, crypto.randomUUID()))).toBe("NOT_FOUND");
    const req = value(await requestAdjustment(env.deps, t.chef, count(t.tomato)));
    value(await decideAdjustment(env.deps, t.m, req.requestId, false, "contagem errada"));
    expect(code(await cancelAdjustment(env.deps, t.chef, req.requestId))).toBe("REQUEST_NOT_PENDING");
    const all = value(await listAdjustmentRequests(env.deps, t.m, { status: "ALL" }));
    expect(all.map((r) => [r.status, r.reasonLabel])).toEqual([["REJECTED", "Conferi na prateleira"]]);
  });
});

describe("itens do formulário de lançamento (spec 004)", () => {
  it("só os ativos, em ordem de código", async () => {
    const env = testEnv();
    const t = await setup(env);
    expect(value(await movementItemOptions(env.deps, t.chef)).map((i) => i.id)).toEqual([t.tomato]);
  });
});
