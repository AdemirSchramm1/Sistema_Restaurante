import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, testDb, testEnv } from "./harness";
import { withTenantTx } from "../../src/infra/db/db";

describe("trilha de auditoria só de inserção (research R10)", () => {
  it("UPDATE e DELETE em audit_log falham para a aplicação", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const count = await withTenantTx(testDb(), ctx.restaurantId, async (tx) => {
      const r = await tx.execute(sql`select count(*)::int as n from audit_log`);
      return (r.rows[0] as { n: number }).n;
    });
    expect(count).toBeGreaterThan(0);

    await expect(
      withTenantTx(testDb(), ctx.restaurantId, (tx) => tx.execute(sql`update audit_log set entity = 'x'`)),
    ).rejects.toThrow();
    await expect(
      withTenantTx(testDb(), ctx.restaurantId, (tx) => tx.execute(sql`delete from audit_log`)),
    ).rejects.toThrow();
  });
});
