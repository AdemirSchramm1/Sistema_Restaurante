import { describe, it, expect } from "vitest";
import { testEnv } from "../harness";
import { code, unwrap } from "../ordering/fixtures";
import { cashScenario, money } from "./fixtures";
import { getCashSessionReport, listCashSessions } from "../../../src/application/cash/reports";

/** Spec 014, US5 e FR-006: relatório do turno e lista de turnos. */

describe("relatório do turno (spec 014, US5)", () => {
  it("turno fechado: abertura, recebido por forma, lançamentos, todas as contagens, passo a passo e resultado", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const { sessionId, withdrawal } = await s.specShift();
    unwrap(await s.count(sessionId, "120.00"));
    env.clock.advance(60_000);
    unwrap(await s.closeSession(sessionId, "125.00", { kept: "100.00", note: "Troco errado na mesa 4" }));

    const r = unwrap(await getCashSessionReport(env.deps, s.ana, sessionId));
    expect(r).toMatchObject({
      id: sessionId,
      status: "CLOSED",
      businessDay: "2026-10-31",
      restaurantName: "Restaurante Sabor",
      timezone: "America/Sao_Paulo",
      openedByName: "Ana",
      closedByName: "Ana",
      openingNote: null,
      result: "SHORT",
      closeNote: "Troco errado na mesa 4",
    });
    expect(r.closedAt?.toISOString()).toBe(env.clock.now().toISOString());
    expect(r.receivedByMethod.map((x) => [x.method, money(x.amount)])).toEqual([
      ["CASH", "77.00"],
      ["PIX", "40.00"],
      ["DEBIT_CARD", "0.00"],
      ["CREDIT_CARD", "0.00"],
      ["OTHER", "0.00"],
    ]);
    expect(
      [
        r.openingFloat,
        r.received,
        r.serviceCharge,
        r.expected,
        r.counted,
        r.difference,
        r.kept,
        r.takenToSafe,
      ].map(money),
    ).toEqual(["150.00", "117.00", "0.00", "127.00", "125.00", "-2.00", "100.00", "25.00"]);
    expect(r.removedFromOtherSessions).toEqual([]);
    expect(
      r.entries.map((e) => [e.id === withdrawal.entryId, e.kind, money(e.amount), e.reason, e.note]),
    ).toEqual([
      [true, "WITHDRAWAL", "150.00", "SAFE", null],
      [false, "SUPPLY", "50.00", null, "Troco do cofre"],
    ]);
    expect(r.counts.map((c) => money(c.counted))).toEqual(["120.00", "125.00"]);
    expect(r.steps!.map((x) => [x.key, money(x.amount)])).toEqual([
      ["OPENING_FLOAT", "150.00"],
      ["CASH_RECEIVED", "77.00"],
      ["CASH_REMOVED", "0.00"],
      ["SUPPLIES", "50.00"],
      ["WITHDRAWALS", "150.00"],
      ["EXPECTED", "127.00"],
    ]);
  });

  it("turno aberto: o gerente vê o parcial com o esperado; o caixa só depois de contar", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const { sessionId } = await s.specShift();
    const manager = unwrap(await getCashSessionReport(env.deps, s.m, sessionId));
    expect(manager).toMatchObject({
      status: "OPEN",
      closedAt: null,
      closedByName: null,
      counted: null,
      difference: null,
      result: null,
      kept: null,
      takenToSafe: null,
      closeNote: null,
    });
    expect(money(manager.expected)).toBe("127.00");
    expect(manager.steps).toHaveLength(6);

    const cashier = unwrap(await getCashSessionReport(env.deps, s.ana, sessionId));
    expect([cashier.expected, cashier.steps]).toEqual([null, null]);
    expect(money(cashier.received)).toBe("117.00");
    unwrap(await s.count(sessionId, "125.00"));
    const counted = unwrap(await getCashSessionReport(env.deps, s.ana, sessionId));
    expect(money(counted.expected)).toBe("127.00");
    expect(counted.counted).toBeNull();
  });

  it("garçom não vê relatório nem lista; turno de outro restaurante não existe aqui", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const other = await cashScenario(env, "Restaurante Vizinho");
    const theirs = await other.openSession();
    const mine = await s.openSession();
    expect(code(await getCashSessionReport(env.deps, s.waiter, mine))).toBe("FORBIDDEN");
    expect(code(await listCashSessions(env.deps, s.waiter, { from: "2026-10-31", to: "2026-10-31" }))).toBe(
      "FORBIDDEN",
    );
    expect(code(await getCashSessionReport(env.deps, s.m, theirs))).toBe("NOT_FOUND");
    expect(code(await getCashSessionReport(env.deps, s.m, "x"))).toBe("NOT_FOUND");
    const list = unwrap(await listCashSessions(env.deps, s.m, { from: "2026-10-31", to: "2026-10-31" }));
    expect(list.sessions.map((x) => x.id)).toEqual([mine]);
  });

  it("lista de turnos por período, o mais recente primeiro, com recebido e resultado", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const { sessionId: first } = await s.specShift();
    unwrap(await s.closeSession(first, "125.00", { note: "Troco errado" }));
    env.clock.advance(24 * 3600_000);
    const second = await s.openSession("125.00");
    env.clock.advance(3600_000);
    unwrap(await s.closeSession(second, "125.00"));
    env.clock.advance(3600_000);
    const third = await s.openSession("125.00");

    const list = unwrap(await listCashSessions(env.deps, s.ana, { from: "2026-10-31", to: "2026-11-01" }));
    expect(list.timezone).toBe("America/Sao_Paulo");
    expect(
      list.sessions.map((x) => [
        x.id,
        x.businessDay,
        x.status,
        x.openedByName,
        x.closedByName,
        money(x.received),
        money(x.difference),
        x.result,
      ]),
    ).toEqual([
      [third, "2026-11-01", "OPEN", "Ana", null, "0.00", null, null],
      [second, "2026-11-01", "CLOSED", "Ana", "Ana", "0.00", "0.00", "BALANCED"],
      [first, "2026-10-31", "CLOSED", "Ana", "Ana", "117.00", "-2.00", "SHORT"],
    ]);
    const onlyFirst = unwrap(
      await listCashSessions(env.deps, s.ana, { from: "2026-10-31", to: "2026-10-31" }),
    );
    expect(onlyFirst.sessions.map((x) => x.id)).toEqual([first]);
    expect(
      unwrap(await listCashSessions(env.deps, s.ana, { from: "2026-12-01", to: "2026-12-02" })).sessions,
    ).toEqual([]);
  });

  it("período de até 31 dias; 32 é recusado", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    expect(code(await listCashSessions(env.deps, s.m, { from: "2026-10-01", to: "2026-10-31" }))).toBe("OK");
    expect(code(await listCashSessions(env.deps, s.m, { from: "2026-10-01", to: "2026-11-01" }))).toBe(
      "INVALID_PERIOD",
    );
  });
});
