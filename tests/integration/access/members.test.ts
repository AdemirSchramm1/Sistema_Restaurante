import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import { listMembers, setMemberActive, setMemberRoles } from "../../../src/application/access/members";
import { resolveContext } from "../../../src/application/access/resolve-context";
import { createGroup } from "../../../src/application/inventory/groups";

async function versionOf(
  env: ReturnType<typeof testEnv>,
  ctx: Awaited<ReturnType<typeof newRestaurant>>,
  membershipId: string,
) {
  const r = await listMembers(env.deps, ctx);
  if (!r.ok) throw new Error("listMembers");
  return r.value.find((m) => m.membershipId === membershipId)!.version;
}

describe("membros (US5, FR-002)", () => {
  it("não deixa tirar o papel do único gerente nem desativá-lo", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const v = await versionOf(env, manager, manager.membershipId);
    expect(await setMemberRoles(env.deps, manager, manager.membershipId, v, ["CHEF"])).toMatchObject({
      ok: false,
      error: { code: "LAST_MANAGER" },
    });
    expect(await setMemberActive(env.deps, manager, manager.membershipId, v, false)).toMatchObject({
      ok: false,
      error: { code: "LAST_MANAGER" },
    });
  });

  it("muda papéis com trava otimista e registra na auditoria", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const chef = await addMember(env, manager, ["CHEF"]);
    const v = await versionOf(env, manager, chef.membershipId);
    expect((await setMemberRoles(env.deps, manager, chef.membershipId, v, ["CHEF", "BUYER"])).ok).toBe(true);
    expect(await setMemberRoles(env.deps, manager, chef.membershipId, v, ["CHEF"])).toMatchObject({
      ok: false,
      error: { code: "STALE_RECORD" },
    });
    const audit = await ownerTestDb().execute(
      sql`select entity, action, changes from audit_log where entity = 'membership'`,
    );
    expect(audit.rows).toEqual([
      { entity: "membership", action: "UPDATE", changes: { roles: [["CHEF"], ["BUYER", "CHEF"]] } },
    ]);
  });

  it("chef não muda papéis", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const chef = await addMember(env, manager, ["CHEF"]);
    const v = await versionOf(env, manager, chef.membershipId);
    expect(await setMemberRoles(env.deps, chef, chef.membershipId, v, ["MANAGER"])).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("membro desativado perde o acesso, e o histórico mantém o usuário dele", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const other = await addMember(env, manager, ["MANAGER"], "Segundo gerente");
    expect(
      (await createGroup(env.deps, other, { name: "Eventos", storageClass: "OTHER_NON_FOOD", inCogs: false }))
        .ok,
    ).toBe(true);
    const v = await versionOf(env, manager, other.membershipId);
    expect((await setMemberActive(env.deps, manager, other.membershipId, v, false)).ok).toBe(true);
    expect(await resolveContext(env.deps, other.userId, { channel: "test" })).toBeNull();
    const audit = await ownerTestDb().execute(
      sql`select user_id from audit_log where entity = 'item_group' and action = 'CREATE'`,
    );
    expect(audit.rows).toEqual([{ user_id: other.userId }]);
    const v2 = await versionOf(env, manager, other.membershipId);
    expect((await setMemberActive(env.deps, manager, other.membershipId, v2, true)).ok).toBe(true);
    expect(await resolveContext(env.deps, other.userId, { channel: "test" })).not.toBeNull();
  });
});
