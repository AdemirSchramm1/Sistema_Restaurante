import { describe, expect, it, vi } from "vitest";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testEnv } from "./harness";
import { itemData } from "../builders/item-data";
import { createItem } from "../../src/application/inventory/create-item";
import { getShellInfo } from "../../src/application/shell";

/** Spec 012, US4 cenário 3 e R5: o cabeçalho de toda tela sai de uma transação só. */
describe("cabeçalho da tela: nome do restaurante e número do Repor (spec 012, R5)", () => {
  it("devolve os dois numa transação só", async () => {
    const env = testEnv();
    const m = await newRestaurant(env, "Cantina da Nona");
    const sub = await subgroupId(env, m, "01", "02");
    const created = await createItem(env.deps, m, itemData({ subgroupId: sub, description: "Tomate" }));
    if (!created.ok) throw new Error("createItem falhou");
    await ownerTestDb().$client.query("update items set reorder_point = 5 where id = $1", [created.value.id]);
    const tenant = vi.spyOn(env.deps, "tenant");

    expect(await getShellInfo(env.deps, m)).toEqual({
      ok: true,
      value: { restaurantName: "Cantina da Nona", reorderCount: 1 },
    });
    expect(tenant).toHaveBeenCalledTimes(1);
  });

  it("quem não vê o estoque recebe só o nome, sem contagem e sem tentativa negada na auditoria", async () => {
    const env = testEnv();
    const m = await newRestaurant(env, "Cantina da Nona");
    const waiter = await addMember(env, m, ["WAITER"], "Garçom");

    expect(await getShellInfo(env.deps, waiter)).toEqual({
      ok: true,
      value: { restaurantName: "Cantina da Nona", reorderCount: null },
    });
    const denied = await ownerTestDb().$client.query(
      "select count(*)::int as n from audit_log where action = 'DENIED' and user_id = $1",
      [waiter.userId],
    );
    expect(denied.rows[0].n).toBe(0);
  });
});
