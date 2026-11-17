import { describe, it, expect } from "vitest";
import { ownerTestDb, testEnv } from "../harness";
import { code, unwrap } from "../ordering/fixtures";
import { cashScenario, money } from "./fixtures";
import { supplyInput, withdrawalInput } from "../../builders/cash-data";
import { addCashEntry, getCashEntry, removeCashEntry } from "../../../src/application/cash/entries";
import { getCurrentCashSession } from "../../../src/application/cash/sessions";

/** Spec 014, US3 e FR-003: sangria e reforço. */

const db = () => ownerTestDb().$client;
const expected = async (env: ReturnType<typeof testEnv>, s: Awaited<ReturnType<typeof cashScenario>>) =>
  money(unwrap(await getCurrentCashSession(env.deps, s.m)).session!.expected);

describe("sangria e reforço (spec 014, US3)", () => {
  it("grava sangria e reforço com quem e quando, soma 1 na versão e muda o esperado", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const sessionId = await s.openSession();
    const order = await s.served("12", [s.burger(3), s.juice(3)]);
    unwrap(await s.pay(order.tabId, "CASH", "77.00", "100.00"));
    unwrap(await s.pay(order.tabId, "PIX", "40.00"));
    expect(await expected(env, s)).toBe("227.00");
    const v0 = (await s.sessionRow(sessionId)).version as number;

    const withdrawal = unwrap(await s.withdraw("150.00", "SAFE"));
    const supply = unwrap(await s.supply("50.00", " Troco do cofre "));
    expect(await expected(env, s)).toBe("127.00");
    expect((await s.sessionRow(sessionId)).version).toBe(v0 + 2);

    const rows = await db().query(
      "select id, kind, amount, reason, note, created_by, created_at from cash_entries order by created_at, id",
    );
    expect(rows.rows.map((r) => [r.id, r.kind, r.amount, r.reason, r.note, r.created_by])).toEqual([
      [withdrawal.entryId, "WITHDRAWAL", "150.00", "SAFE", null, s.ana.userId],
      [supply.entryId, "SUPPLY", "50.00", null, "Troco do cofre", s.ana.userId],
    ]);
    expect((rows.rows[0].created_at as Date).toISOString()).toBe(env.clock.now().toISOString());
  });

  it("sem caixa aberto não há sangria nem reforço", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const refused = await s.supply();
    expect(code(refused)).toBe("CASH_SESSION_REQUIRED");
    expect(!refused.ok && refused.error.details).toEqual({ action: "entry" });
    expect(code(await s.withdraw("1.00"))).toBe("CASH_SESSION_REQUIRED");
  });

  it("sangria acima do esperado é recusada com o esperado do momento; os erros de preenchimento também", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    await s.openSession();
    const over = await s.withdraw("150.01");
    expect(code(over)).toBe("WITHDRAWAL_EXCEEDS_EXPECTED");
    expect(!over.ok && over.error.details).toEqual({ expected: "150.00" });
    expect(code(await s.withdraw("10.00", null))).toBe("REASON_REQUIRED");
    expect(code(await s.withdraw("10.00", "OTHER"))).toBe("NOTE_REQUIRED");
    expect(code(await s.withdraw("0"))).toBe("INVALID_AMOUNT");
    expect(code(await s.supply("0"))).toBe("INVALID_AMOUNT");
    expect(code(await s.supply("1.00", "a".repeat(141)))).toBe("NOTE_TOO_LONG");
    expect(code(await addCashEntry(env.deps, s.ana, { ...supplyInput(), kind: "OTHER" as never }))).toBe(
      "VALIDATION",
    );
    expect(code(await addCashEntry(env.deps, s.ana, { ...supplyInput(), clientRequestId: "x" }))).toBe(
      "VALIDATION",
    );
    expect((await db().query("select count(*)::int as n from cash_entries")).rows[0].n).toBe(0);
  });

  it("duas sangrias ao mesmo tempo que juntas passariam do esperado: a segunda é recusada", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    await s.openSession("150.00");
    const both = await Promise.all([s.withdraw("100.00"), s.withdraw("100.00", "SAFE", null, s.m)]);
    expect(both.map(code).sort()).toEqual(["OK", "WITHDRAWAL_EXCEEDS_EXPECTED"]);
    const refused = both.find((r) => !r.ok)!;
    expect(!refused.ok && refused.error.details).toEqual({ expected: "50.00" });
    expect(await expected(env, s)).toBe("50.00");
  });

  it("toque duplo não lança duas vezes", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const sessionId = await s.openSession();
    const input = withdrawalInput("10.00");
    const first = unwrap(await addCashEntry(env.deps, s.ana, input));
    expect(unwrap(await addCashEntry(env.deps, s.ana, input)).entryId).toBe(first.entryId);
    expect((await db().query("select count(*)::int as n from cash_entries")).rows[0].n).toBe(1);
    expect((await s.sessionRow(sessionId)).version).toBe(2);
  });

  it("tirar grava a remoção; o lançamento continua na lista, riscado, e sai do esperado", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const sessionId = await s.openSession();
    const withdrawal = unwrap(await s.withdraw("100.00"));
    expect(await expected(env, s)).toBe("50.00");
    env.clock.advance(60_000);
    unwrap(await removeCashEntry(env.deps, s.m, { entryId: withdrawal.entryId }));
    expect(await expected(env, s)).toBe("150.00");
    expect((await s.sessionRow(sessionId)).version).toBe(3);
    const entries = unwrap(await getCurrentCashSession(env.deps, s.ana)).session!.entries;
    expect(entries.map((e) => [e.id, e.byName, e.removedByName, e.removedAt?.toISOString()])).toEqual([
      [withdrawal.entryId, "Ana", "Gerente", env.clock.now().toISOString()],
    ]);
    const again = await removeCashEntry(env.deps, s.ana, { entryId: withdrawal.entryId });
    expect(code(again)).toBe("ALREADY_REMOVED");
    expect(!again.ok && again.error.details).toEqual({ entry: true });
    expect(code(await removeCashEntry(env.deps, s.ana, { entryId: env.deps.ids.next() }))).toBe("NOT_FOUND");
    expect(code(await removeCashEntry(env.deps, s.ana, { entryId: "x" }))).toBe("NOT_FOUND");
  });

  it("tirar um reforço que deixaria o esperado negativo é recusado; de turno fechado, também", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const sessionId = await s.openSession("0.00");
    const supply = unwrap(await s.supply("50.00"));
    unwrap(await s.withdraw("20.00"));
    expect(code(await removeCashEntry(env.deps, s.ana, { entryId: supply.entryId }))).toBe(
      "EXPECTED_WOULD_BE_NEGATIVE",
    );
    unwrap(await s.closeSession(sessionId, "30.00"));
    expect(code(await removeCashEntry(env.deps, s.ana, { entryId: supply.entryId }))).toBe(
      "CASH_SESSION_CLOSED",
    );
    expect((await db().query("select count(*)::int as n from cash_entry_removals")).rows[0].n).toBe(0);
  });

  it("garçom não lança nem tira; tudo fica na auditoria do turno", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const sessionId = await s.openSession();
    expect(code(await addCashEntry(env.deps, s.waiter, supplyInput()))).toBe("FORBIDDEN");
    const supply = unwrap(await s.supply("50.00"));
    expect(code(await removeCashEntry(env.deps, s.waiter, { entryId: supply.entryId }))).toBe("FORBIDDEN");
    expect(code(await getCashEntry(env.deps, s.waiter, supply.entryId))).toBe("FORBIDDEN");
    unwrap(await removeCashEntry(env.deps, s.ana, { entryId: supply.entryId }));
    const audit = await db().query(
      "select action, entity_id, changes from audit_log where entity = 'cash_session' and user_id = $1 order by occurred_at, id",
      [s.ana.userId],
    );
    expect(audit.rows.map((r) => [r.action, r.entity_id, Object.keys(r.changes)[0]])).toEqual([
      ["CREATE", sessionId, "opened"],
      ["UPDATE", sessionId, "entryAdded"],
      ["UPDATE", sessionId, "entryRemoved"],
    ]);
    expect(audit.rows[1].changes.entryAdded).toEqual({
      entryId: supply.entryId,
      kind: "SUPPLY",
      amount: "50.00",
      reason: null,
      note: null,
    });
  });

  it("o comprovante tem o lançamento, o restaurante e o fuso", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    await s.openSession();
    const w = unwrap(await s.withdraw("150.00", "OTHER", "Gelo"));
    const receipt = unwrap(await getCashEntry(env.deps, s.ana, w.entryId));
    expect(receipt).toMatchObject({
      restaurantName: "Restaurante Sabor",
      timezone: "America/Sao_Paulo",
      entry: { id: w.entryId, kind: "WITHDRAWAL", reason: "OTHER", note: "Gelo", byName: "Ana" },
    });
    expect(money(receipt.entry.amount)).toBe("150.00");
    expect(code(await getCashEntry(env.deps, s.ana, env.deps.ids.next()))).toBe("NOT_FOUND");
    expect(code(await getCashEntry(env.deps, s.ana, "x"))).toBe("NOT_FOUND");
  });
});
