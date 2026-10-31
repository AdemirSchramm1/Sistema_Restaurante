import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { ownerTestDb, testEnv } from "./harness";
import { signUpRestaurant } from "../../src/application/access/sign-up-restaurant";
import { DEFAULT_GROUP_TREE } from "../../src/domain/inventory/default-tree";

const input = {
  restaurantName: "Cantina da Praça",
  userName: "Ana",
  email: "Ana@Exemplo.com.br",
  password: "senha-forte-123",
};

describe("criar a conta do restaurante (spec 001, US5.1)", () => {
  it("cria restaurante, gerente, árvore padrão e quarentena", async () => {
    const env = testEnv();
    const r = await signUpRestaurant(env.deps, input, { channel: "test" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const db = ownerTestDb();
    const id = r.value.restaurantId;

    const rest = await db.execute(sql`select name, timezone from restaurants where id = ${id}`);
    expect(rest.rows[0]).toEqual({ name: "Cantina da Praça", timezone: "America/Sao_Paulo" });

    const roles =
      await db.execute(sql`select mr.role from membership_roles mr join memberships m on m.id = mr.membership_id
      where m.restaurant_id = ${id} and m.user_id = ${r.value.userId} and m.active`);
    expect(roles.rows).toEqual([{ role: "MANAGER" }]);

    const groups = await db.execute(
      sql`select count(*)::int as n from item_groups where restaurant_id = ${id} and is_system`,
    );
    expect((groups.rows[0] as { n: number }).n).toBe(DEFAULT_GROUP_TREE.length);
    const subs = await db.execute(
      sql`select count(*)::int as n from item_subgroups where restaurant_id = ${id}`,
    );
    expect((subs.rows[0] as { n: number }).n).toBe(
      DEFAULT_GROUP_TREE.reduce((n, g) => n + g.subgroups.length, 0),
    );

    const q = await db.execute(sql`select name, kind, is_system from locations where restaurant_id = ${id}`);
    expect(q.rows).toEqual([{ name: "Recebimento / quarentena", kind: "QUARANTINE", is_system: true }]);

    const user = await db.execute(sql`select email from users where id = ${r.value.userId}`);
    expect(user.rows[0]).toEqual({ email: "ana@exemplo.com.br" });

    const audit = await db.execute(
      sql`select entity, action from audit_log where restaurant_id = ${id} and entity = 'restaurant'`,
    );
    expect(audit.rows).toEqual([{ entity: "restaurant", action: "CREATE" }]);
  });

  it("recusa e-mail já cadastrado", async () => {
    const env = testEnv();
    await signUpRestaurant(env.deps, input, { channel: "test" });
    const r = await signUpRestaurant(
      env.deps,
      { ...input, email: "ana@exemplo.com.br" },
      { channel: "test" },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("EMAIL_IN_USE");
  });

  it("recusa senha curta", async () => {
    const env = testEnv();
    const r = await signUpRestaurant(env.deps, { ...input, password: "123" }, { channel: "test" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("WEAK_PASSWORD");
  });
});
