import { describe, expect, it, vi } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import { resolveContext } from "../../../src/application/access/resolve-context";

/**
 * Spec 012, US4 cenário 2 e R4: o contexto de quem está logado (restaurante e papéis) sai de uma
 * consulta só. Antes, cada carregamento de tela abria uma transação do restaurante só para ler
 * os papéis.
 */
describe("contexto do login numa consulta (spec 012, FR-007)", () => {
  it("monta restaurante, membro e papéis sem abrir transação do restaurante", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const cook = await addMember(env, m, ["WAITER", "CHEF"], "Cozinheiro");
    const tenant = vi.spyOn(env.deps, "tenant");

    const ctx = await resolveContext(env.deps, cook.userId, { channel: "test" });

    expect(ctx).toEqual({
      userId: cook.userId,
      restaurantId: m.restaurantId,
      membershipId: cook.membershipId,
      roles: ["CHEF", "WAITER"],
      origin: { channel: "test" },
    });
    expect(tenant).not.toHaveBeenCalled();
  });

  it("membro desativado ou sem restaurante não tem contexto", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const other = await addMember(env, m, ["WAITER"]);
    await ownerTestDb().$client.query("update memberships set active = false where id = $1", [other.membershipId]);
    expect(await resolveContext(env.deps, other.userId, { channel: "test" })).toBeNull();

    const created = await env.deps.auth.createUser({
      email: `sem-restaurante-${Date.now()}@teste.com.br`,
      password: "senha-forte-123",
      name: "Sem restaurante",
    });
    if (!created.ok) throw new Error("createUser falhou");
    expect(await resolveContext(env.deps, created.value.userId, { channel: "test" })).toBeNull();
  });

  it("membro sem papel tem contexto com a lista de papéis vazia", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const other = await addMember(env, m, ["WAITER"]);
    await ownerTestDb().$client.query("delete from membership_roles where membership_id = $1", [other.membershipId]);
    const ctx = await resolveContext(env.deps, other.userId, { channel: "test" });
    expect(ctx?.roles).toEqual([]);
  });
});
