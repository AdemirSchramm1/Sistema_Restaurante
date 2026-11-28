import { describe, expect, it } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import { searchAudit } from "../../../src/application/audit/search-audit";

const db = () => ownerTestDb().$client;

/**
 * `n` registros na trilha do restaurante, um a cada minuto para trás a partir de `until`, alternando
 * entre as pessoas e as entidades dadas (SQL direto: rápido).
 */
async function fill(restaurantId: string, users: string[], n: number, until: Date) {
  await db().query(
    `insert into audit_log (id, restaurant_id, entity, entity_id, action, changes, user_id, occurred_at, origin)
     select gen_random_uuid(), $1, (array['item','order','table_tab','stock_movement','supplier'])[1 + g % 5],
            gen_random_uuid(), (case when g % 50 = 0 then 'DENIED' else 'UPDATE' end)::audit_action,
            '{"name":["A","B"]}'::jsonb, ($2::uuid[])[1 + g % cardinality($2::uuid[])],
            $3::timestamptz - make_interval(mins => g), '{"channel":"test"}'::jsonb
       from generate_series(1, $4::int) g`,
    [restaurantId, users, until.toISOString(), n],
  );
  await db().query("analyze audit_log");
}

/** Spec 019, SC-004: a Auditoria responde em até 1 s com 100 mil registros na trilha. */
describe("relatório de auditoria com 100 mil registros (spec 019, SC-004)", () => {
  it("hoje, 31 dias, por pessoa, por tipo e só negadas: cada um em menos de 1 s", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const chef = await addMember(env, m, ["CHEF"], "Chef Bia");
    const other = await newRestaurant(env, "Outro");
    // 100 mil em ~70 dias aqui, e outros 100 mil no outro restaurante.
    await fill(m.restaurantId, [m.userId, chef.userId], 100_000, env.clock.now());
    await fill(other.restaurantId, [other.userId], 100_000, env.clock.now());

    const filters: Record<string, string>[] = [
      {},
      { de: "2026-10-01", ate: "2026-10-31" },
      { de: "2026-10-01", ate: "2026-10-31", pessoa: chef.userId },
      { de: "2026-10-01", ate: "2026-10-31", tipo: "TABS" },
      { de: "2026-10-01", ate: "2026-10-31", negadas: "1", pagina: "5" },
    ];
    for (const q of filters) {
      const started = performance.now();
      const r = await searchAudit(env.deps, m, q);
      const ms = performance.now() - started;
      expect(r.ok, JSON.stringify(q)).toBe(true);
      if (r.ok) expect(r.value.rows.length, JSON.stringify(q)).toBeGreaterThan(0);
      expect(ms, JSON.stringify(q)).toBeLessThan(1000);
    }
  });
});
