import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testEnv, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { registerPurchase } from "../../../src/application/inventory/movements";
import {
  getReorderView,
  listReorderAlerts,
  setReorderLevels,
} from "../../../src/application/inventory/reorder";
import type { RequestContext } from "../../../src/application/context";
import { d } from "../../../src/domain/shared/decimal";
import type { Result } from "../../../src/domain/shared/result";

/** Spec 018, US2: recusas e casos do aviso de reposição (spec 006) que faltavam. */

const code = (r: Result<unknown>) => (r.ok ? "OK" : r.error.code);
const value = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
};
const levels = (reorderPoint: string, parLevel: string | null = null) => ({
  reorderPoint: d(reorderPoint),
  parLevel: parLevel === null ? null : d(parLevel),
});

/** Item em unidade, sem embalagem de compra, com `units` unidades no estoque. */
async function loose(env: TestEnv, m: RequestContext, description: string, units: string) {
  const sub = await subgroupId(env, m, "01", "02");
  const id = value(
    await createItem(
      env.deps,
      m,
      itemData({
        subgroupId: sub,
        description,
        stockUnit: "un",
        purchaseUnitLabel: null,
        purchaseFactor: null,
      }),
    ),
  ).id;
  value(
    await registerPurchase(env.deps, m, {
      itemId: id,
      quantity: d(units),
      unit: "un",
      totalPaid: d(units),
      occurredAt: env.clock.now(),
      notes: null,
      idempotencyKey: null,
    }),
  );
  return id;
}

describe("aviso de reposição: recusas e casos (spec 006)", () => {
  it("garçom não vê os avisos nem o quadro do item; item que não existe é NOT_FOUND", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const waiter = await addMember(env, m, ["WAITER"]);
    const egg = await loose(env, m, "Ovo", "1");
    expect(code(await listReorderAlerts(env.deps, waiter))).toBe("FORBIDDEN");
    expect(code(await getReorderView(env.deps, waiter, egg))).toBe("FORBIDDEN");
    expect(code(await getReorderView(env.deps, m, crypto.randomUUID()))).toBe("NOT_FOUND");
    expect(code(await setReorderLevels(env.deps, m, crypto.randomUUID(), 1, levels("2")))).toBe("NOT_FOUND");
  });

  it("salvar os mesmos níveis de novo não escreve no histórico", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const egg = await loose(env, m, "Ovo", "1");
    value(await setReorderLevels(env.deps, m, egg, 1, levels("2", "6")));
    value(await setReorderLevels(env.deps, m, egg, 2, levels("2", "6")));
    const r = await ownerTestDb().$client.query(
      "select count(*)::int as n from audit_log where entity_id = $1 and changes ? 'reorderPoint'",
      [egg],
    );
    expect(r.rows[0].n).toBe(1);
  });

  it("empate na distância do ponto vai pelo nome; sem embalagem e sem fornecedor compra solto", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const egg = await loose(env, m, "Ovo", "1");
    const lemon = await loose(env, m, "Limão", "1");
    value(await setReorderLevels(env.deps, m, egg, 1, levels("2", "4")));
    value(await setReorderLevels(env.deps, m, lemon, 1, levels("2", "4")));
    const alerts = value(await listReorderAlerts(env.deps, m));
    expect(alerts.map((a) => a.name)).toEqual(["Limão", "Ovo"]);
    expect(alerts.map((a) => [a.supplier, a.order.quantity?.toString(), a.order.packages])).toEqual([
      [null, "3", null],
      [null, "3", null],
    ]);
  });

  it("quadro do item sem fornecedor e sem consumo: não há sugestão", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const egg = await loose(env, m, "Ovo", "1");
    expect(value(await getReorderView(env.deps, m, egg))).toMatchObject({
      suggestion: null,
      atReorderPoint: false,
    });
  });

  it("item sem saldo e sem consumo: vem antes de todos e o quadro não sugere nada", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const egg = await loose(env, m, "Ovo", "1");
    const lemon = await loose(env, m, "Limão", "3");
    const sub = await subgroupId(env, m, "01", "02");
    const salt = value(
      await createItem(
        env.deps,
        m,
        itemData({
          subgroupId: sub,
          description: "Sal",
          stockUnit: "un",
          purchaseUnitLabel: null,
          purchaseFactor: null,
        }),
      ),
    ).id;
    for (const id of [egg, lemon, salt]) value(await setReorderLevels(env.deps, m, id, 1, levels("4")));
    expect(value(await listReorderAlerts(env.deps, m)).map((a) => a.name)).toEqual(["Sal", "Ovo", "Limão"]);
    expect(value(await getReorderView(env.deps, m, salt))).toMatchObject({
      suggestion: null,
      atReorderPoint: true,
    });
  });
});
