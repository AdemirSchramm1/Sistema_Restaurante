import { describe, it, expect } from "vitest";
import { ownerTestDb, testEnv } from "../harness";
import { code, unwrap } from "../ordering/fixtures";
import { cashScenario } from "./fixtures";
import { closeCashSession } from "../../../src/application/cash/closing";
import { d } from "../../../src/domain/shared/decimal";

/** Spec 014, SC-003 e research R2: pagamento × fechamento do caixa ao mesmo tempo. */

const db = () => ownerTestDb().$client;

describe("pagamento e fechamento do caixa ao mesmo tempo (spec 014, SC-003)", () => {
  it("em 20 rodadas, ou o pagamento entra e o fechamento pede nova contagem, ou o fechamento vale e o pagamento é recusado", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const order = await s.served("12", [s.juice(20)]);
    const outcomes = new Set<string>();

    for (let round = 0; round < 20; round++) {
      const sessionId = await s.openSession("0.00");
      unwrap(await s.count(sessionId, "0.00"));
      const [paid, closed] = await Promise.all([
        s.pay(order.tabId, "PIX", "9.00"),
        closeCashSession(env.deps, s.ana, { sessionId, kept: null, note: null }),
      ]);
      const outcome = `${code(paid)}/${code(closed)}`;
      outcomes.add(outcome);
      expect(["OK/COUNT_OUTDATED", "CASH_SESSION_REQUIRED/OK"]).toContain(outcome);
      if (!closed.ok) {
        unwrap(await s.count(sessionId, "0.00"));
        unwrap(await closeCashSession(env.deps, s.ana, { sessionId, kept: d("0"), note: null }));
      }
      // Nenhum pagamento gravado depois do fechamento do seu turno.
      const late = await db().query(
        `select count(*)::int as n from tab_payments p join cash_sessions c on c.id = p.cash_session_id
         where c.id = $1 and p.created_at > c.closed_at`,
        [sessionId],
      );
      expect(late.rows[0].n).toBe(0);
    }
    const orphans = await db().query(
      "select count(*)::int as n from tab_payments where cash_session_id is null",
    );
    expect(orphans.rows[0].n).toBe(0);
    expect(outcomes.size).toBeGreaterThan(0);
  });
});
