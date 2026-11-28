import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, subgroupId, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { updateItem } from "../../../src/application/inventory/update-item";
import { getAuditHistory } from "../../../src/application/audit/get-audit-history";

describe("histórico do registro (FR-004, SC-007)", () => {
  it("mostra quem criou e quem alterou, com antes e depois, em ordem", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const chef = await addMember(env, manager, ["CHEF"], "Chef Bia");
    const sub = await subgroupId(env, manager, "01", "02");
    const created = await createItem(env.deps, manager, itemData({ subgroupId: sub }));
    if (!created.ok) throw new Error();
    env.clock.advance(60_000);
    await updateItem(
      env.deps,
      chef,
      created.value.id,
      1,
      itemData({ subgroupId: sub, purchaseUnitLabel: "Saco" }),
    );

    const h = await getAuditHistory(env.deps, chef, "item", created.value.id);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.value.map((e) => [e.action, e.userName])).toEqual([
      ["CREATE", "Gerente"],
      ["UPDATE", "Chef Bia"],
    ]);
    expect(h.value[1]!.changes).toEqual({ purchaseUnitLabel: ["Caixa", "Saco"] });
    expect(h.value[1]!.occurredAt.getTime() - h.value[0]!.occurredAt.getTime()).toBe(60_000);
  });

  it("garçom e caixa não veem o histórico do cadastro, e a tentativa fica na trilha", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const waiter = await addMember(env, manager, ["WAITER"], "Garçom Leo");
    const sub = await subgroupId(env, manager, "01", "02");
    const created = await createItem(env.deps, manager, itemData({ subgroupId: sub }));
    if (!created.ok) throw new Error();
    const h = await getAuditHistory(env.deps, waiter, "item", created.value.id);
    expect(h).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    const all = await env.deps.tenant(manager.restaurantId, async (repos) => ({
      ok: true as const,
      value: await repos.audit.history("item", created.value.id),
    }));
    expect(all.ok && all.value.map((e) => [e.action, e.userId])).toEqual([
      ["CREATE", manager.userId],
      ["DENIED", waiter.userId],
    ]);
  });
});
