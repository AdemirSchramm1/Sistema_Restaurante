import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import { inviteMember } from "../../../src/application/access/invite-member";
import { acceptInvitation } from "../../../src/application/access/accept-invitation";
import { revokeInvitation } from "../../../src/application/access/revoke-invitation";
import { resolveContext } from "../../../src/application/access/resolve-context";

const tokenFrom = (text: string) => {
  const m = /\/convite\/([A-Za-z0-9_-]+)/.exec(text);
  if (!m?.[1]) throw new Error("link do convite não encontrado");
  return m[1];
};

describe("convites (US5, FR-002)", () => {
  it("grava só o hash do token e manda o link por e-mail", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env, "Cantina da Ana");
    const r = await inviteMember(env.deps, manager, { email: " Chef@Exemplo.com ", roles: ["CHEF"] });
    expect(r.ok).toBe(true);
    const mail = env.mailer.last("chef@exemplo.com");
    expect(mail?.text).toContain("Cantina da Ana");
    const token = tokenFrom(mail!.text);
    const rows = await ownerTestDb().execute(sql`select email, token_hash, status, roles from invitations`);
    expect(rows.rows).toEqual([
      {
        email: "chef@exemplo.com",
        token_hash: createHash("sha256").update(token).digest("hex"),
        status: "PENDING",
        roles: "{CHEF}",
      },
    ]);
  });

  it("convite pendente repetido → INVITATION_PENDING", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    await inviteMember(env.deps, manager, { email: "chef@exemplo.com", roles: ["CHEF"] });
    const again = await inviteMember(env.deps, manager, { email: "chef@exemplo.com", roles: ["BUYER"] });
    expect(again).toMatchObject({ ok: false, error: { code: "INVITATION_PENDING" } });
  });

  it("e-mail de membro de outro restaurante → EMAIL_BELONGS_TO_OTHER_RESTAURANT; do mesmo → ALREADY_MEMBER", async () => {
    const env = testEnv();
    const a = await newRestaurant(env, "Restaurante A");
    const b = await newRestaurant(env, "Restaurante B");
    const emailA = (await ownerTestDb().execute(sql`select email from users where id = ${a.userId}`)).rows[0]!
      .email as string;
    expect(await inviteMember(env.deps, b, { email: emailA, roles: ["CHEF"] })).toMatchObject({
      ok: false,
      error: { code: "EMAIL_BELONGS_TO_OTHER_RESTAURANT" },
    });
    expect(await inviteMember(env.deps, a, { email: emailA, roles: ["CHEF"] })).toMatchObject({
      ok: false,
      error: { code: "ALREADY_MEMBER" },
    });
  });

  it("só quem tem user.invite convida", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const chef = await addMember(env, manager, ["CHEF"]);
    expect(await inviteMember(env.deps, chef, { email: "x@exemplo.com", roles: ["CHEF"] })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("aceitar cria o usuário e o vínculo com os papéis do convite", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    await inviteMember(env.deps, manager, { email: "chef@exemplo.com", roles: ["CHEF", "BUYER"] });
    const token = tokenFrom(env.mailer.last("chef@exemplo.com")!.text);
    const r = await acceptInvitation(
      env.deps,
      { token, name: "Chef Ana", password: "senha-forte-123" },
      { channel: "test" },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ctx = await resolveContext(env.deps, r.value.userId, { channel: "test" });
    expect(ctx?.restaurantId).toBe(manager.restaurantId);
    expect([...(ctx?.roles ?? [])].sort()).toEqual(["BUYER", "CHEF"]);
    const status = await ownerTestDb().execute(sql`select status from invitations`);
    expect(status.rows).toEqual([{ status: "ACCEPTED" }]);
    expect(
      await acceptInvitation(
        env.deps,
        { token, name: "Outra", password: "senha-forte-123" },
        { channel: "test" },
      ),
    ).toMatchObject({
      ok: false,
      error: { code: "INVITATION_INVALID" },
    });
  });

  it("token revogado → INVITATION_INVALID; token desconhecido também", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    const inv = await inviteMember(env.deps, manager, { email: "chef@exemplo.com", roles: ["CHEF"] });
    if (!inv.ok) throw new Error("convite");
    const token = tokenFrom(env.mailer.last()!.text);
    expect((await revokeInvitation(env.deps, manager, inv.value.invitationId)).ok).toBe(true);
    const input = { token, name: "Chef", password: "senha-forte-123" };
    expect(await acceptInvitation(env.deps, input, { channel: "test" })).toMatchObject({
      ok: false,
      error: { code: "INVITATION_INVALID" },
    });
    expect(
      await acceptInvitation(env.deps, { ...input, token: "inexistente" }, { channel: "test" }),
    ).toMatchObject({
      ok: false,
      error: { code: "INVITATION_INVALID" },
    });
  });

  it("depois de 7 dias → INVITATION_EXPIRED, e o e-mail pode ser convidado de novo", async () => {
    const env = testEnv();
    const manager = await newRestaurant(env);
    await inviteMember(env.deps, manager, { email: "chef@exemplo.com", roles: ["CHEF"] });
    const token = tokenFrom(env.mailer.last()!.text);
    env.clock.advance(7 * 24 * 3600 * 1000 + 1000);
    expect(
      await acceptInvitation(
        env.deps,
        { token, name: "Chef", password: "senha-forte-123" },
        { channel: "test" },
      ),
    ).toMatchObject({
      ok: false,
      error: { code: "INVITATION_EXPIRED" },
    });
    expect((await inviteMember(env.deps, manager, { email: "chef@exemplo.com", roles: ["CHEF"] })).ok).toBe(
      true,
    );
  });
});
