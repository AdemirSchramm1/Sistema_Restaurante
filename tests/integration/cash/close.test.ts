import { describe, it, expect } from "vitest";
import { ownerTestDb, testEnv } from "../harness";
import { code, unwrap } from "../ordering/fixtures";
import { cashScenario, money } from "./fixtures";
import { closeCashSession, countCash, getCashClosing } from "../../../src/application/cash/closing";
import { getCashSessionReport } from "../../../src/application/cash/reports";
import { expectedCash } from "../../../src/domain/cash/summary";
import { d } from "../../../src/domain/shared/decimal";

/** Spec 014, US4 e FR-005: contar sem ver o esperado e fechar o caixa. */

const db = () => ownerTestDb().$client;

describe("contar e fechar o caixa (spec 014, US4)", () => {
  it("a contagem fica gravada com a versão do turno, devolve esperado e diferença e não muda a versão", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const { sessionId } = await s.specShift();
    const v0 = (await s.sessionRow(sessionId)).version as number;

    const before = unwrap(await getCashClosing(env.deps, s.ana));
    expect(before).toMatchObject({
      sessionId,
      openedByName: "Ana",
      lastCount: null,
      counts: [],
      openTabs: 1,
    });

    const counted = unwrap(
      await countCash(env.deps, s.ana, {
        sessionId,
        counted: d("125.00"),
        denominations: { "100": 1, "20": 1, "5": 1 },
      }),
    );
    expect([money(counted.expected), money(counted.difference), counted.result]).toEqual([
      "127.00",
      "-2.00",
      "SHORT",
    ]);
    expect((await s.sessionRow(sessionId)).version).toBe(v0);
    const row = (await db().query("select * from cash_counts where id = $1", [counted.countId])).rows[0];
    expect(row).toMatchObject({
      cash_session_id: sessionId,
      counted: "125.00",
      denominations: { "100": 1, "20": 1, "5": 1 },
      session_version: v0,
      created_by: s.ana.userId,
    });
    const after = unwrap(await getCashClosing(env.deps, s.ana));
    expect(after.lastCount).toMatchObject({ result: "SHORT", outdated: false });
    expect([
      money(after.lastCount!.counted),
      money(after.lastCount!.expected),
      money(after.lastCount!.difference),
    ]).toEqual(["125.00", "127.00", "-2.00"]);
    expect(after.counts.map(money)).toEqual(["125.00"]);
  });

  it("contagem inválida é recusada; sem caixa aberto não há o que contar", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const none = await getCashClosing(env.deps, s.ana);
    expect(code(none)).toBe("CASH_SESSION_REQUIRED");
    expect(!none.ok && none.error.details).toEqual({ action: "close" });
    const sessionId = await s.openSession();
    expect(code(await s.count(sessionId, "-1"))).toBe("INVALID_AMOUNT");
    expect(
      code(await countCash(env.deps, s.ana, { sessionId, counted: d("10.00"), denominations: { "5": 1 } })),
    ).toBe("DENOMINATIONS_MISMATCH");
    expect(code(await s.count(env.deps.ids.next(), "1"))).toBe("NOT_FOUND");
    expect(code(await s.count("x", "1"))).toBe("NOT_FOUND");
    expect(code(await closeCashSession(env.deps, s.ana, { sessionId: "x", kept: null, note: null }))).toBe(
      "NOT_FOUND",
    );
    expect(
      code(
        await closeCashSession(env.deps, s.ana, { sessionId: env.deps.ids.next(), kept: null, note: null }),
      ),
    ).toBe("NOT_FOUND");
    expect((await db().query("select count(*)::int as n from cash_counts")).rows[0].n).toBe(0);
  });

  it("fechar sem contar é recusado; dinheiro que entra depois da contagem pede nova contagem", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const { sessionId } = await s.specShift();
    const close = (kept: string | null = null, note: string | null = "Troco errado na mesa 4") =>
      closeCashSession(env.deps, s.ana, { sessionId, kept: kept === null ? null : d(kept), note });
    expect(code(await close())).toBe("COUNT_REQUIRED");

    const first = unwrap(await s.count(sessionId, "120.00"));
    unwrap(await s.supply("10.00"));
    expect(code(await close())).toBe("COUNT_OUTDATED");
    const stale = unwrap(await getCashClosing(env.deps, s.ana));
    expect(stale.lastCount).toMatchObject({ outdated: true, expected: null, difference: null, result: null });

    env.clock.advance(60_000);
    const second = unwrap(await s.count(sessionId, "135.00"));
    expect(money(second.expected)).toBe("137.00");
    expect(code(await close(null, null))).toBe("NOTE_REQUIRED");
    expect(code(await close("135.01"))).toBe("KEPT_ABOVE_COUNTED");
    env.clock.advance(60_000);
    const closed = unwrap(await close("100.00"));
    expect(closed).toEqual({ sessionId, openTabs: 1 });

    const row = await s.sessionRow(sessionId);
    expect(row).toMatchObject({
      status: "CLOSED",
      expected: "137.00",
      counted: "135.00",
      difference: "-2.00",
      kept: "100.00",
      service_charge: "0.00",
      closing_count_id: second.countId,
      close_note: "Troco errado na mesa 4",
      closed_by: s.ana.userId,
    });
    expect((row.closed_at as Date).toISOString()).toBe(env.clock.now().toISOString());
    expect(first.countId).not.toBe(second.countId);
    expect((await db().query("select count(*)::int as n from cash_counts")).rows[0].n).toBe(2);
  });

  it("depois de fechado o turno não muda, e lançar pagamento volta a pedir a abertura", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const { sessionId, tabId } = await s.specShift();
    unwrap(await s.closeSession(sessionId, "127.00"));
    await expect(
      db().query("update cash_sessions set counted = 1 where id = $1", [sessionId]),
    ).rejects.toThrow(/APPEND_ONLY/);
    const { getTab } = await import("../../../src/application/billing/tabs");
    expect(unwrap(await getTab(env.deps, s.ana, tabId)).cashSessionOpen).toBe(false);
    expect(code(await s.supply("1.00"))).toBe("CASH_SESSION_REQUIRED");
    const again = await s.count(sessionId, "127.00");
    expect(code(again)).toBe("CASH_SESSION_ALREADY_CLOSED");
    expect(code(await getCashClosing(env.deps, s.ana))).toBe("CASH_SESSION_REQUIRED");
  });

  it("dois fechamentos ao mesmo tempo: um vale e o outro vê quem fechou e quando", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const sessionId = await s.openSession();
    unwrap(await s.count(sessionId, "150.00"));
    const both = await Promise.all([
      closeCashSession(env.deps, s.ana, { sessionId, kept: null, note: null }),
      closeCashSession(env.deps, s.m, { sessionId, kept: null, note: null }),
    ]);
    expect(both.map(code).sort()).toEqual(["CASH_SESSION_ALREADY_CLOSED", "OK"]);
    const refused = both.find((r) => !r.ok)!;
    expect(!refused.ok && refused.error.details).toEqual({
      closedByName: both[0]!.ok ? "Ana" : "Gerente",
      closedAt: env.clock.now().toISOString(),
      timezone: "America/Sao_Paulo",
    });
  });

  it("Bruno não conta nem fecha o turno de Ana; o gerente fecha e o relatório mostra quem abriu e quem fechou", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const sessionId = await s.openSession();
    expect(code(await s.count(sessionId, "150.00", s.bruno))).toBe("FORBIDDEN");
    expect(code(await getCashClosing(env.deps, s.bruno))).toBe("FORBIDDEN");
    expect(code(await s.count(sessionId, "150.00", s.waiter))).toBe("FORBIDDEN");
    expect(code(await getCashClosing(env.deps, s.waiter))).toBe("FORBIDDEN");
    unwrap(await s.count(sessionId, "150.00"));
    expect(code(await closeCashSession(env.deps, s.bruno, { sessionId, kept: null, note: null }))).toBe(
      "FORBIDDEN",
    );
    expect(code(await closeCashSession(env.deps, s.waiter, { sessionId, kept: null, note: null }))).toBe(
      "FORBIDDEN",
    );
    unwrap(await closeCashSession(env.deps, s.m, { sessionId, kept: null, note: null }));
    const report = unwrap(await getCashSessionReport(env.deps, s.bruno, sessionId));
    expect([report.openedByName, report.closedByName]).toEqual(["Ana", "Gerente"]);
    const denied = await db().query(
      "select count(*)::int as n from audit_log where entity = 'cash_session' and action = 'DENIED' and user_id = $1",
      [s.bruno.userId],
    );
    expect(denied.rows[0].n).toBe(3);
  });

  it("o esperado gravado é a conta refeita a partir das linhas (SC-004), e a contagem e o fechamento vão para a auditoria", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const { sessionId, tabId, pix } = await s.specShift();
    unwrap(await s.unpay(tabId, pix.paymentId));
    unwrap(await s.pay(tabId, "CASH", "40.00", "50.00"));
    const extra = unwrap(await s.supply("10.00"));
    const { removeCashEntry } = await import("../../../src/application/cash/entries");
    unwrap(await removeCashEntry(env.deps, s.ana, { entryId: extra.entryId }));
    unwrap(await s.closeSession(sessionId, "167.00"));

    const sum = async (q: string) => d((await db().query(q, [sessionId])).rows[0].v as string);
    const redone = expectedCash({
      openingFloat: await sum("select opening_float as v from cash_sessions where id = $1"),
      cashReceived: await sum(
        `select coalesce(sum(p.amount), 0) as v from tab_payments p
         where p.cash_session_id = $1 and p.method = 'CASH'
           and not exists (select 1 from tab_payment_removals r where r.payment_id = p.id and r.cash_session_id = $1)`,
      ),
      cashRemovedFromOtherSessions: await sum(
        `select coalesce(sum(p.amount), 0) as v from tab_payment_removals r join tab_payments p on p.id = r.payment_id
         where r.cash_session_id = $1 and p.method = 'CASH' and p.cash_session_id is distinct from $1`,
      ),
      supplies: await sum(
        `select coalesce(sum(e.amount), 0) as v from cash_entries e where e.cash_session_id = $1 and e.kind = 'SUPPLY'
           and not exists (select 1 from cash_entry_removals r where r.entry_id = e.id)`,
      ),
      withdrawals: await sum(
        `select coalesce(sum(e.amount), 0) as v from cash_entries e where e.cash_session_id = $1 and e.kind = 'WITHDRAWAL'
           and not exists (select 1 from cash_entry_removals r where r.entry_id = e.id)`,
      ),
    });
    expect(money(redone)).toBe("167.00");
    expect((await s.sessionRow(sessionId)).expected).toBe("167.00");

    const audit = await db().query(
      "select changes from audit_log where entity = 'cash_session' and entity_id = $1 and action = 'UPDATE' order by occurred_at, id",
      [sessionId],
    );
    const keys = audit.rows.map((r) => Object.keys(r.changes)[0]);
    expect(keys.slice(-2)).toEqual(["counted", "closed"]);
    expect(audit.rows.at(-1)!.changes.closed).toEqual({
      expected: "167.00",
      counted: "167.00",
      difference: "0.00",
      kept: "167.00",
      serviceCharge: "0.00",
      note: null,
    });
  });

  it("a taxa de serviço das contas fechadas no turno fica congelada no fechamento", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    await db().query("update restaurants set service_charge_rate = 10 where id = $1", [s.m.restaurantId]);
    const sessionId = await s.openSession();
    const order = await s.served("12", [s.burger()]);
    unwrap(await s.pay(order.tabId, "PIX", "33.00"));
    unwrap(await s.closeTabOf(order.tabId));
    await s.served("4", [s.juice()]); // conta que continua aberta: a taxa dela não entra
    unwrap(await s.closeSession(sessionId, "150.00"));
    expect((await s.sessionRow(sessionId)).service_charge).toBe("3.00");

    // Reabrir e fechar a conta em outro turno não muda o turno fechado.
    const { getTab, reopenTab } = await import("../../../src/application/billing/tabs");
    const tab = unwrap(await getTab(env.deps, s.m, order.tabId));
    unwrap(await reopenTab(env.deps, s.m, { tabId: order.tabId, reason: "Conferir", version: tab.version }));
    const next = await s.openSession("150.00");
    unwrap(await s.closeTabOf(order.tabId));
    expect(money(unwrap(await getCashSessionReport(env.deps, s.m, sessionId)).serviceCharge)).toBe("3.00");
    expect(money(unwrap(await getCashSessionReport(env.deps, s.m, next)).serviceCharge)).toBe("3.00");
  });
});
