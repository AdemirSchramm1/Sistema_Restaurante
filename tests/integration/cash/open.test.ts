import { describe, it, expect } from "vitest";
import { ownerTestDb, testEnv } from "../harness";
import { code, unwrap } from "../ordering/fixtures";
import { cashScenario, money } from "./fixtures";
import { openingInput } from "../../builders/cash-data";
import { getCurrentCashSession, openCashSession } from "../../../src/application/cash/sessions";

/** Spec 014, US1 e FR-001: abrir o caixa com o troco; um aberto por restaurante. */

const db = () => ownerTestDb().$client;

describe("abrir o caixa (spec 014, US1)", () => {
  it("grava troco, quem, quando e o dia do restaurante; a tela vê o turno aberto", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    // 23:30 em São Paulo do dia 17: o turno é do dia 17, mesmo fechando depois da meia-noite.
    env.clock.current = new Date("2026-11-18T02:30:00Z");
    const before = unwrap(await getCurrentCashSession(env.deps, s.ana));
    expect(before).toMatchObject({ session: null, previousKept: null, canOperate: true });

    const { id } = unwrap(await openCashSession(env.deps, s.ana, openingInput("150.00")));
    const row = await s.sessionRow(id);
    expect(row).toMatchObject({
      status: "OPEN",
      business_day: "2026-11-17",
      opened_by: s.ana.userId,
      opening_float: "150.00",
      previous_kept: null,
      opening_note: null,
      version: 1,
    });
    expect((row.opened_at as Date).toISOString()).toBe("2026-11-18T02:30:00.000Z");

    env.clock.advance(90 * 60_000);
    const now = unwrap(await getCurrentCashSession(env.deps, s.waiter));
    expect(now.canOperate).toBe(false);
    expect(now.timezone).toBe("America/Sao_Paulo");
    expect(now.session).toMatchObject({ id, openedByName: "Ana", ageHours: 1, version: 1, entries: [] });
    expect(money(now.session!.openingFloat)).toBe("150.00");
    expect(now.session!.receivedByMethod.every((r) => r.amount.isZero())).toBe(true);
  });

  it("o gerente vê o esperado do turno aberto; o caixa e o garçom não recebem esse valor", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    await s.specShift();
    const manager = unwrap(await getCurrentCashSession(env.deps, s.m)).session!;
    expect([money(manager.expected), money(manager.received)]).toEqual(["127.00", "117.00"]);
    expect(manager.receivedByMethod.slice(0, 2).map((r) => [r.method, money(r.amount)])).toEqual([
      ["CASH", "77.00"],
      ["PIX", "40.00"],
    ]);
    expect(manager.entries.map((e) => [e.kind, money(e.amount)])).toEqual([
      ["WITHDRAWAL", "150.00"],
      ["SUPPLY", "50.00"],
    ]);
    for (const who of [s.ana, s.waiter])
      expect(unwrap(await getCurrentCashSession(env.deps, who)).session!.expected).toBeNull();
    // Só quem abriu (ou o gerente) fecha.
    expect(unwrap(await getCurrentCashSession(env.deps, s.ana)).canClose).toBe(true);
    expect(unwrap(await getCurrentCashSession(env.deps, s.bruno)).canClose).toBe(false);
    expect(unwrap(await getCurrentCashSession(env.deps, s.m)).canClose).toBe(true);
    expect(unwrap(await getCurrentCashSession(env.deps, s.waiter)).canClose).toBe(false);
  });

  it("o troco vem do que ficou na gaveta no último fechamento; troco diferente pede observação", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const first = await s.openSession("150.00");
    unwrap(await s.closeSession(first, "150.00", { kept: "100.00" }));
    expect(money(unwrap(await getCurrentCashSession(env.deps, s.ana)).previousKept)).toBe("100.00");

    const other = await openCashSession(env.deps, s.ana, openingInput("80.00"));
    expect(code(other)).toBe("OPENING_NOTE_REQUIRED");
    expect(!other.ok && other.error.details).toEqual({ previousKept: "100.00" });
    const { id } = unwrap(await openCashSession(env.deps, s.ana, openingInput("80.00", "Troquei R$ 20,00")));
    expect(await s.sessionRow(id)).toMatchObject({
      opening_float: "80.00",
      previous_kept: "100.00",
      opening_note: "Troquei R$ 20,00",
    });
  });

  it("troco inválido e observação comprida são recusados antes de gravar", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    expect(code(await openCashSession(env.deps, s.ana, openingInput("-1")))).toBe("INVALID_AMOUNT");
    expect(code(await openCashSession(env.deps, s.ana, openingInput("1", "a".repeat(141))))).toBe(
      "NOTE_TOO_LONG",
    );
    expect(
      code(await openCashSession(env.deps, s.ana, { ...openingInput(), clientRequestId: "não é id" })),
    ).toBe("VALIDATION");
    expect((await db().query("select count(*)::int as n from cash_sessions")).rows[0].n).toBe(0);
  });

  it("duas aberturas ao mesmo tempo: uma abre e a outra vê quem abriu e quando", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const results = await Promise.all([
      openCashSession(env.deps, s.ana, openingInput("150.00")),
      openCashSession(env.deps, s.bruno, openingInput("100.00")),
    ]);
    expect(results.map(code).sort()).toEqual(["CASH_SESSION_ALREADY_OPEN", "OK"]);
    const winner = results[0]!.ok ? "Ana" : "Bruno";
    const refused = results.find((r) => !r.ok)!;
    expect(!refused.ok && refused.error.details).toEqual({
      openedByName: winner,
      openedAt: env.clock.now().toISOString(),
      timezone: "America/Sao_Paulo",
    });
    // Com o caixa já aberto, a recusa vem sem tentar gravar.
    const late = await openCashSession(env.deps, s.m, openingInput("10.00"));
    expect(code(late)).toBe("CASH_SESSION_ALREADY_OPEN");
    expect((await db().query("select count(*)::int as n from cash_sessions")).rows[0].n).toBe(1);
  });

  it("toque duplo em Abrir caixa devolve o mesmo turno", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const input = openingInput("150.00");
    const first = unwrap(await openCashSession(env.deps, s.ana, input));
    const again = unwrap(await openCashSession(env.deps, s.ana, input));
    expect(again.id).toBe(first.id);
    const both = await Promise.all([
      openCashSession(env.deps, s.ana, input),
      openCashSession(env.deps, s.ana, input),
    ]);
    expect(both.map((r) => unwrap(r).id)).toEqual([first.id, first.id]);
  });

  it("toque duplo ao mesmo tempo, com o caixa fechado, abre um turno só", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const input = openingInput("150.00");
    const both = await Promise.all([
      openCashSession(env.deps, s.ana, input),
      openCashSession(env.deps, s.ana, input),
    ]);
    expect(unwrap(both[0]!).id).toBe(unwrap(both[1]!).id);
    expect((await db().query("select count(*)::int as n from cash_sessions")).rows[0].n).toBe(1);
  });

  it("garçom e chef não abrem o caixa e a tentativa fica na auditoria; a abertura também fica", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    expect(code(await openCashSession(env.deps, s.waiter, openingInput()))).toBe("FORBIDDEN");
    expect(code(await openCashSession(env.deps, s.chef, openingInput()))).toBe("FORBIDDEN");
    expect(code(await getCurrentCashSession(env.deps, s.chef))).toBe("FORBIDDEN");
    const { id } = unwrap(await openCashSession(env.deps, s.m, openingInput("150.00")));
    const audit = await db().query(
      "select action, entity_id, user_id, changes from audit_log where entity = 'cash_session' order by occurred_at, id",
    );
    expect(audit.rows.map((r) => [r.action, r.user_id])).toEqual([
      ["DENIED", s.waiter.userId],
      ["DENIED", s.chef.userId],
      ["DENIED", s.chef.userId],
      ["CREATE", s.m.userId],
    ]);
    expect(audit.rows[3]).toMatchObject({
      entity_id: id,
      changes: { opened: { openingFloat: "150.00", previousKept: null, note: null } },
    });
  });
});
