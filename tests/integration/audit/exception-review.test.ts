import { beforeEach, describe, expect, it } from "vitest";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testEnv, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import {
  decideAdjustment,
  registerPurchase,
  requestAdjustment,
} from "../../../src/application/inventory/movements";
import { getSmallOperation, setSmallOperation } from "../../../src/application/audit/small-operation";
import {
  markWeekReviewed,
  pendingReviews,
  weekExceptions,
} from "../../../src/application/audit/exception-review";
import { searchAudit } from "../../../src/application/audit/search-audit";
import { getShellInfo } from "../../../src/application/shell";
import type { RequestContext } from "../../../src/application/context";
import { reasonByCode } from "../../../src/domain/inventory/movement-reasons";
import { d } from "../../../src/domain/shared/decimal";
import type { Result } from "../../../src/domain/shared/result";

const SHELF = reasonByCode("ADJUSTMENT", "SHELF_CHECK")!.id;
const code = (r: Result<unknown>) => (r.ok ? "OK" : r.error.code);
const value = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};

/** Spec 019, US3: toda semana encerrada com exceção pede revisão até ser marcada. */
describe("revisão semanal das exceções (spec 019, US3)", () => {
  let env: TestEnv;
  let m: RequestContext;
  let tomato: string;

  /** Pede e decide um acerto do tomate para `counted` kg na hora `at` (UTC). */
  const adjust = async (at: string, counted: number, who = m, decider = m, approve = true) => {
    env.clock.current = new Date(at);
    const { requestId } = value(
      await requestAdjustment(env.deps, who, {
        itemId: tomato,
        countedQuantity: d(counted),
        unit: "kg",
        reasonId: SHELF,
        notes: `contagem ${counted}`,
      }),
    );
    value(await decideAdjustment(env.deps, decider, requestId, approve, null));
    return requestId;
  };
  const now = (at: string) => {
    env.clock.current = new Date(at);
  };

  beforeEach(async () => {
    env = testEnv();
    env.clock.current = new Date("2026-10-01T12:00:00Z");
    m = await newRestaurant(env);
    const sub = await subgroupId(env, m, "01", "02");
    tomato = value(await createItem(env.deps, m, itemData({ subgroupId: sub, description: "Tomate" }))).id;
    value(
      await registerPurchase(env.deps, m, {
        itemId: tomato,
        quantity: d(20),
        unit: "kg",
        totalPaid: d(60),
        occurredAt: env.clock.now(),
        notes: null,
        idempotencyKey: null,
      }),
    );
    const { version } = value(await getSmallOperation(env.deps, m));
    value(await setSmallOperation(env.deps, m, { enabled: true, version }));
  });

  it("semana em andamento não pede; encerrada pede, no fuso do restaurante", async () => {
    // Sábado 31/10 (semana de 26/10 a 01/11) e domingo 01/11 23:00 em São Paulo (02/11 02:00 UTC).
    await adjust("2026-10-31T12:00:00Z", 19);
    await adjust("2026-11-02T02:00:00Z", 18);
    expect(value(await pendingReviews(env.deps, m))).toEqual([]);
    now("2026-11-02T03:00:00Z"); // segunda 02/11 00:00 em São Paulo
    expect(value(await pendingReviews(env.deps, m))).toEqual(["2026-10-26"]);
  });

  it("recusa de quem pediu, acerto aprovado por outro gerente e semana sem acerto não pedem revisão", async () => {
    const other = await addMember(env, m, ["MANAGER"], "Outro gerente");
    await adjust("2026-10-13T12:00:00Z", 19, m, m, false);
    await adjust("2026-10-14T12:00:00Z", 18, m, other);
    now("2026-11-30T12:00:00Z");
    expect(value(await pendingReviews(env.deps, m))).toEqual([]);
    expect(code(await markWeekReviewed(env.deps, m, { weekStart: "2026-10-12", note: "" }))).toBe(
      "NO_EXCEPTIONS",
    );
  });

  it("várias semanas atrasadas aparecem todas, a mais antiga primeiro", async () => {
    await adjust("2026-10-28T12:00:00Z", 18);
    await adjust("2026-10-14T12:00:00Z", 19);
    await adjust("2026-10-15T12:00:00Z", 17);
    now("2026-11-04T12:00:00Z");
    expect(value(await pendingReviews(env.deps, m))).toEqual(["2026-10-12", "2026-10-26"]);
  });

  it("a revisão lista as exceções da semana com valor, motivo e saldo atual", async () => {
    const chef = await addMember(env, m, ["CHEF"], "Chef Bia");
    await adjust("2026-10-14T12:00:00Z", 19); // -1 kg a R$ 3,00
    await adjust("2026-10-15T15:30:00Z", 21); // +2 kg
    await adjust("2026-10-16T12:00:00Z", 20, chef, m); // aprovado por quem não pediu: não entra
    now("2026-10-20T12:00:00Z");
    const week = value(await weekExceptions(env.deps, m, "2026-10-12"));
    expect(week).toMatchObject({
      weekStart: "2026-10-12",
      weekEnd: "2026-10-18",
      closed: true,
      review: null,
      total: "3.00",
    });
    expect(
      week.exceptions.map((e) => [
        e.decidedAt.toISOString(),
        e.decidedByName,
        e.itemName,
        e.difference,
        e.stockUnit,
        e.value,
        e.reasonLabel,
        e.notes,
        e.balance,
      ]),
    ).toEqual([
      [
        "2026-10-14T12:00:00.000Z",
        "Gerente",
        "Tomate",
        "-1",
        "kg",
        "-3.00",
        "Conferi na prateleira",
        "contagem 19",
        "20",
      ],
      [
        "2026-10-15T15:30:00.000Z",
        "Gerente",
        "Tomate",
        "2",
        "kg",
        "6.00",
        "Conferi na prateleira",
        "contagem 21",
        "20",
      ],
    ]);
  });

  it("marcar como revisada grava quem, quando e a observação, vai para a trilha e o aviso some", async () => {
    await adjust("2026-10-14T12:00:00Z", 19);
    now("2026-10-19T03:00:00Z");
    expect(code(await markWeekReviewed(env.deps, m, { weekStart: "2026-10-19", note: "" }))).toBe(
      "WEEK_NOT_CLOSED",
    );
    expect(code(await markWeekReviewed(env.deps, m, { weekStart: "2026-10-13", note: "" }))).toBe(
      "INVALID_WEEK",
    );
    expect(
      await markWeekReviewed(env.deps, m, { weekStart: "2026-10-12", note: "a".repeat(141) }),
    ).toMatchObject({ ok: false, error: { code: "NOTE_TOO_LONG", field: "note" } });
    expect(value(await pendingReviews(env.deps, m))).toEqual(["2026-10-12"]);

    value(await markWeekReviewed(env.deps, m, { weekStart: "2026-10-12", note: " Conferi a prateleira. " }));
    expect(value(await pendingReviews(env.deps, m))).toEqual([]);
    expect(code(await markWeekReviewed(env.deps, m, { weekStart: "2026-10-12", note: "" }))).toBe(
      "ALREADY_REVIEWED",
    );
    const week = value(await weekExceptions(env.deps, m, "2026-10-12"));
    expect(week.review).toEqual({
      reviewedByName: "Gerente",
      reviewedAt: new Date("2026-10-19T03:00:00Z"),
      note: "Conferi a prateleira.",
    });
    const trail = value(
      await searchAudit(env.deps, m, { de: "2026-10-19", ate: "2026-10-19", tipo: "STOCK" }),
    ).rows.filter((r) => r.entity === "exception_review");
    expect(trail.map((r) => [r.action, r.userName, r.changes])).toEqual([
      ["CREATE", "Gerente", { weekStart: [null, "2026-10-12"], note: [null, "Conferi a prateleira."] }],
    ]);
  });

  it("semana em andamento abre a lista, mas não deixa marcar", async () => {
    await adjust("2026-10-14T12:00:00Z", 19);
    const week = value(await weekExceptions(env.deps, m, "2026-10-12"));
    expect(week).toMatchObject({ closed: false, review: null, total: "-3.00" });
    expect(week.exceptions).toHaveLength(1);
    expect(code(await weekExceptions(env.deps, m, "2026-10-14"))).toBe("INVALID_WEEK");
  });

  it("só o gerente vê e marca; o cabeçalho do gerente traz o aviso", async () => {
    const chef = await addMember(env, m, ["CHEF"], "Chef Bia");
    await adjust("2026-10-14T12:00:00Z", 19);
    now("2026-10-20T12:00:00Z");
    expect(code(await pendingReviews(env.deps, chef))).toBe("FORBIDDEN");
    expect(code(await weekExceptions(env.deps, chef, "2026-10-12"))).toBe("FORBIDDEN");
    expect(code(await markWeekReviewed(env.deps, chef, { weekStart: "2026-10-12", note: "" }))).toBe(
      "FORBIDDEN",
    );
    expect(value(await getShellInfo(env.deps, m)).pendingReviewWeeks).toEqual(["2026-10-12"]);
    expect(value(await getShellInfo(env.deps, chef)).pendingReviewWeeks).toBeNull();
  });

  it("a revisão é só inserção e uma por semana no banco", async () => {
    await adjust("2026-10-14T12:00:00Z", 19);
    now("2026-10-20T12:00:00Z");
    value(await markWeekReviewed(env.deps, m, { weekStart: "2026-10-12", note: "" }));
    const db = ownerTestDb().$client;
    await expect(db.query("update exception_reviews set note = 'x'")).rejects.toThrow(/APPEND_ONLY/);
    await expect(db.query("delete from exception_reviews")).rejects.toThrow(/APPEND_ONLY/);
    await expect(
      db.query(
        `insert into exception_reviews (id, restaurant_id, created_at, created_by, week_start)
         select gen_random_uuid(), restaurant_id, now(), created_by, week_start from exception_reviews`,
      ),
    ).rejects.toThrow(/exception_reviews_week/);
    await expect(
      db.query(
        `insert into exception_reviews (id, restaurant_id, created_at, created_by, week_start)
         select gen_random_uuid(), restaurant_id, now(), created_by, '2026-10-13' from exception_reviews`,
      ),
    ).rejects.toThrow(/exception_reviews_monday/);
  });
});
