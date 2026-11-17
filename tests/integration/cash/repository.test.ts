import { describe, it, expect } from "vitest";
import { testEnv, type TestEnv } from "../harness";
import { code, unwrap } from "../ordering/fixtures";
import { cashScenario, money } from "./fixtures";
import type { Repos } from "../../../src/application/ports";
import type { RequestContext } from "../../../src/application/context";
import { d } from "../../../src/domain/shared/decimal";
import { ok } from "../../../src/domain/shared/result";

/** Spec 014, T014: o repositório do caixa contra o PostgreSQL de verdade. */

const inRepos = async <T>(env: TestEnv, ctx: RequestContext, fn: (repos: Repos) => Promise<T>): Promise<T> =>
  unwrap(await env.deps.tenant(ctx.restaurantId, async (repos) => ok(await fn(repos))));
const methods = (rows: { method: string; amount: { toFixed(n: number): string } }[]) =>
  rows.map((r) => [r.method, money(r.amount)]);

describe("repositório do caixa (spec 014, data-model.md)", () => {
  it("abre o turno e devolve o aberto; o segundo é recusado; sem turno, nada a travar", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const audit = { at: env.clock.now(), by: s.ana.userId };
    const id = env.deps.ids.next();
    const requestId = crypto.randomUUID();
    await inRepos(env, s.ana, async (repos) => {
      expect(await repos.cashSessions.current()).toBeNull();
      expect(await repos.cashSessions.lockOpen()).toBeNull();
      expect(await repos.cashSessions.lastClosed()).toBeNull();
      expect(await repos.cashSessions.get(id)).toBeNull();
      expect(await repos.cashSessions.lock(id)).toBeNull();
      const session = {
        id,
        businessDay: "2026-10-31",
        openingFloat: d("150.00"),
        previousKept: null,
        note: null,
        clientRequestId: requestId,
      };
      expect(code(await repos.cashSessions.open(session, audit))).toBe("OK");
      expect(code(await repos.cashSessions.open({ ...session, id: env.deps.ids.next() }, audit))).toBe(
        "CASH_SESSION_ALREADY_OPEN",
      );
    });
    const open = await inRepos(env, s.ana, (repos) => repos.cashSessions.current());
    expect(open).toMatchObject({
      id,
      status: "OPEN",
      businessDay: "2026-10-31",
      openedBy: s.ana.userId,
      openedByName: "Ana",
      previousKept: null,
      openingNote: null,
      clientRequestId: requestId,
      closing: null,
      version: 1,
    });
    expect([money(open!.openingFloat), open!.openedAt.toISOString()]).toEqual([
      "150.00",
      env.clock.now().toISOString(),
    ]);
    const locked = await inRepos(env, s.ana, (repos) => repos.cashSessions.lockOpen());
    expect(locked?.id).toBe(id);
    expect((await inRepos(env, s.ana, (repos) => repos.cashSessions.lock(id)))?.id).toBe(id);
  });

  it("bumpVersion soma 1; lançamentos entram em ordem, com quem lançou e quem tirou", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const id = await s.openSession();
    const audit = { at: env.clock.now(), by: s.ana.userId };
    const [withdrawal, supply] = [env.deps.ids.next(), env.deps.ids.next()];
    const request = crypto.randomUUID();
    await inRepos(env, s.ana, async (repos) => {
      await repos.cashSessions.bumpVersion(id, audit);
      await repos.cashSessions.insertEntry(
        {
          id: withdrawal,
          sessionId: id,
          kind: "WITHDRAWAL",
          amount: d("150.00"),
          reason: "OTHER",
          note: "Gelo",
          clientRequestId: request,
        },
        audit,
      );
      await repos.cashSessions.insertEntry(
        {
          id: supply,
          sessionId: id,
          kind: "SUPPLY",
          amount: d("50.00"),
          reason: null,
          note: null,
          clientRequestId: crypto.randomUUID(),
        },
        audit,
      );
    });
    env.clock.advance(60_000);
    const later = { at: env.clock.now(), by: s.m.userId };
    await inRepos(env, s.m, async (repos) => {
      expect(code(await repos.cashSessions.removeEntry(supply, env.deps.ids.next(), later))).toBe("OK");
      expect(code(await repos.cashSessions.removeEntry(supply, env.deps.ids.next(), later))).toBe(
        "ALREADY_REMOVED",
      );
    });
    await inRepos(env, s.ana, async (repos) => {
      expect((await repos.cashSessions.get(id))?.version).toBe(2);
      const entries = await repos.cashSessions.entries(id);
      expect(
        entries.map((e) => [e.kind, money(e.amount), e.reason, e.note, e.byName, e.removedByName]),
      ).toEqual([
        ["WITHDRAWAL", "150.00", "OTHER", "Gelo", "Ana", null],
        ["SUPPLY", "50.00", null, null, "Ana", "Gerente"],
      ]);
      expect(entries[1]!.removedAt?.toISOString()).toBe(later.at.toISOString());
      expect(entries[0]!.removedAt).toBeNull();
      expect((await repos.cashSessions.getEntry(withdrawal))?.sessionId).toBe(id);
      expect(await repos.cashSessions.getEntry(env.deps.ids.next())).toBeNull();
      expect((await repos.cashSessions.entryByClientRequest(id, request))?.id).toBe(withdrawal);
      expect(await repos.cashSessions.entryByClientRequest(id, crypto.randomUUID())).toBeNull();
      expect(
        (await repos.cashSessions.entryAmounts([id])).map((e) => [
          e.sessionId,
          e.kind,
          money(e.amount),
          e.removed,
        ]),
      ).toEqual([
        [id, "WITHDRAWAL", "150.00", false],
        [id, "SUPPLY", "50.00", true],
      ]);
      expect(await repos.cashSessions.entryAmounts([])).toEqual([]);
    });
  });

  it("contagens ficam todas gravadas e a última é a do fechamento", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const id = await s.openSession();
    const [first, second] = [env.deps.ids.next(), env.deps.ids.next()];
    await inRepos(env, s.ana, async (repos) => {
      expect(await repos.cashSessions.lastCount(id)).toBeNull();
      await repos.cashSessions.insertCount(
        { id: first, sessionId: id, counted: d("120.00"), denominations: null, sessionVersion: 1 },
        { at: env.clock.now(), by: s.ana.userId },
      );
      env.clock.advance(1000);
      await repos.cashSessions.insertCount(
        {
          id: second,
          sessionId: id,
          counted: d("125.00"),
          denominations: { "100": 1, "20": 1, "5": 1 },
          sessionVersion: 1,
        },
        { at: env.clock.now(), by: s.ana.userId },
      );
      const counts = await repos.cashSessions.counts(id);
      expect(
        counts.map((c) => [c.id, money(c.counted), c.denominations, c.sessionVersion, c.byName]),
      ).toEqual([
        [first, "120.00", null, 1, "Ana"],
        [second, "125.00", { "100": 1, "20": 1, "5": 1 }, 1, "Ana"],
      ]);
      expect((await repos.cashSessions.lastCount(id))?.id).toBe(second);
    });
  });

  it("soma por turno o recebido por forma, os tirados no próprio turno e os tirados de outro turno", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const a = await s.openSession();
    const order = await s.served("12", [s.burger(3), s.juice(3)]);
    unwrap(await s.pay(order.tabId, "CASH", "77.00", "100.00"));
    const wrong = unwrap(await s.pay(order.tabId, "PIX", "10.00"));
    unwrap(await s.unpay(order.tabId, wrong.paymentId));
    const pix = unwrap(await s.pay(order.tabId, "PIX", "40.00"));
    unwrap(await s.closeTabOf(order.tabId));
    unwrap(await s.closeSession(a, "227.00"));
    const empty = await inRepos(env, s.ana, (repos) => repos.cashSessions.payments([]));
    expect(empty).toEqual([]);

    const b = await s.openSession("227.00");
    const { reopenTab } = await import("../../../src/application/billing/tabs");
    const v = unwrap(
      await (await import("../../../src/application/billing/tabs")).getTab(env.deps, s.m, order.tabId),
    );
    unwrap(await reopenTab(env.deps, s.m, { tabId: order.tabId, reason: "Pix errado", version: v.version }));
    unwrap(await s.unpay(order.tabId, pix.paymentId, s.m));
    unwrap(await s.pay(order.tabId, "DEBIT_CARD", "40.00"));

    const sums = await inRepos(env, s.ana, (repos) => repos.cashSessions.payments([a, b]));
    const of = (id: string) => sums.find((x) => x.sessionId === id)!;
    expect(methods(of(a).paid)).toEqual([
      ["CASH", "77.00"],
      ["PIX", "50.00"],
    ]);
    expect(methods(of(a).removedInSession)).toEqual([["PIX", "10.00"]]);
    expect(methods(of(a).removedFromOtherSessions)).toEqual([]);
    expect(methods(of(b).paid)).toEqual([["DEBIT_CARD", "40.00"]]);
    expect(methods(of(b).removedInSession)).toEqual([]);
    expect(methods(of(b).removedFromOtherSessions)).toEqual([["PIX", "40.00"]]);
  });

  it("fechar grava o retrato e soma 1 na versão; a taxa das contas fechadas no turno é somada", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const id = await s.openSession();
    const countId = env.deps.ids.next();
    const audit = { at: env.clock.now(), by: s.ana.userId };
    await inRepos(env, s.ana, async (repos) => {
      expect(money(await repos.cashSessions.serviceCharge(id))).toBe("0.00");
      await repos.cashSessions.insertCount(
        { id: countId, sessionId: id, counted: d("148.00"), denominations: null, sessionVersion: 1 },
        audit,
      );
      await repos.cashSessions.close(
        id,
        {
          expected: d("150.00"),
          counted: d("148.00"),
          difference: d("-2.00"),
          kept: d("100.00"),
          serviceCharge: d("7.70"),
          countId,
          note: "Troco errado",
        },
        audit,
      );
    });
    await inRepos(env, s.ana, async (repos) => {
      expect(await repos.cashSessions.current()).toBeNull();
      const closed = await repos.cashSessions.lastClosed();
      expect(closed).toMatchObject({ id, status: "CLOSED", version: 2 });
      expect(closed!.closing).toMatchObject({
        by: s.ana.userId,
        byName: "Ana",
        countId,
        note: "Troco errado",
      });
      const c = closed!.closing!;
      expect([c.expected, c.counted, c.difference, c.kept, c.serviceCharge].map(money)).toEqual([
        "150.00",
        "148.00",
        "-2.00",
        "100.00",
        "7.70",
      ]);
      expect(c.at.toISOString()).toBe(audit.at.toISOString());
      expect((await repos.cashSessions.list("2026-10-31", "2026-10-31")).map((x) => x.id)).toEqual([id]);
      expect(await repos.cashSessions.list("2026-11-01", "2026-11-30")).toEqual([]);
    });
  });

  it("um restaurante não vê o turno do outro", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    const other = await cashScenario(env, "Restaurante Vizinho");
    const id = await other.openSession();
    await inRepos(env, s.ana, async (repos) => {
      expect(await repos.cashSessions.current()).toBeNull();
      expect(await repos.cashSessions.get(id)).toBeNull();
    });
  });
});
