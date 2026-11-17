import { describe, it, expect } from "vitest";
import { d } from "@/domain/shared/decimal";
import type { CashStatus } from "@/application/cash/sessions";
import type { CashSessionReport, CashSessionRow } from "@/application/cash/reports";
import type { CashClosingState } from "@/application/cash/closing";
import type { CashEntryRecord } from "@/application/cash/ports";
import { cashBarView, closeResultView, entryView, sessionReportView, sessionRowView } from "./view";

const at = new Date("2026-11-17T14:02:00.000Z");
const entry: CashEntryRecord = {
  id: "e1",
  sessionId: "s1",
  kind: "WITHDRAWAL",
  amount: d("150"),
  reason: "SAFE",
  note: null,
  at,
  byName: "Ana",
  removedAt: null,
  removedByName: null,
};

describe("o que a tela do caixa recebe: dinheiro em texto com 2 casas e datas em ISO", () => {
  it("lançamento, tirado ou não", () => {
    expect(entryView(entry)).toEqual({
      id: "e1",
      kind: "WITHDRAWAL",
      amount: "150.00",
      reason: "SAFE",
      note: null,
      at: "2026-11-17T14:02:00.000Z",
      byName: "Ana",
      removedAt: null,
      removedByName: null,
    });
    expect(entryView({ ...entry, removedAt: at, removedByName: "Bruno" }).removedAt).toBe(at.toISOString());
  });

  it("barra: sem turno leva o troco sugerido; com turno, o esperado só se veio do servidor", () => {
    const status: CashStatus = {
      session: null,
      previousKept: d("150"),
      timezone: "America/Sao_Paulo",
      canOperate: true,
      canClose: false,
      serverNow: "2026-11-17T15:00:00.000Z",
    };
    expect(cashBarView(status)).toEqual({ ...status, previousKept: "150.00" });
    const session = {
      id: "s1",
      openedAt: at,
      openedByName: "Ana",
      openingFloat: d("150"),
      receivedByMethod: [],
      received: d(0),
      expected: d("227"),
      entries: [entry],
      ageHours: 2,
      version: 3,
    };
    expect(cashBarView({ ...status, previousKept: null, session }).session).toEqual({
      id: "s1",
      openedAt: at.toISOString(),
      openedByName: "Ana",
      ageHours: 2,
      expected: "227.00",
    });
    expect(cashBarView({ ...status, session: { ...session, expected: null } }).session?.expected).toBeNull();
  });

  it("fechamento: só existe resultado com contagem que ainda vale", () => {
    const state: CashClosingState = {
      sessionId: "s1",
      openedAt: at,
      openedByName: "Ana",
      timezone: "America/Sao_Paulo",
      counts: [d("120"), d("125")],
      lastCount: {
        counted: d("125"),
        expected: d("127"),
        difference: d("-2"),
        result: "SHORT",
        outdated: false,
      },
      openTabs: 3,
    };
    expect(closeResultView(state)).toEqual({
      sessionId: "s1",
      counted: "125.00",
      expected: "127.00",
      difference: "-2.00",
      result: "SHORT",
      counts: ["120.00", "125.00"],
      openTabs: 3,
    });
    expect(closeResultView({ ...state, lastCount: null })).toBeNull();
    expect(
      closeResultView({
        ...state,
        lastCount: { counted: d("125"), expected: null, difference: null, result: null, outdated: true },
      }),
    ).toBeNull();
  });

  const report: CashSessionReport = {
    id: "s1",
    status: "CLOSED",
    businessDay: "2026-11-17",
    restaurantName: "Cantina",
    timezone: "America/Sao_Paulo",
    openedAt: at,
    openedByName: "Ana",
    openingFloat: d("150"),
    previousKept: d("180"),
    openingNote: "Gás",
    closedAt: at,
    closedByName: "Bruno",
    receivedByMethod: [{ method: "CASH", amount: d("77") }],
    received: d("77"),
    removedFromOtherSessions: [{ method: "PIX", amount: d("30") }],
    serviceCharge: d("10.7"),
    entries: [entry],
    counts: [{ id: "c1", counted: d("125"), denominations: null, sessionVersion: 3, at, byName: "Ana" }],
    steps: [{ key: "EXPECTED", sign: "=", amount: d("127") }],
    expected: d("127"),
    counted: d("125"),
    difference: d("-2"),
    result: "SHORT",
    kept: d("100"),
    takenToSafe: d("25"),
    closeNote: "Troco errado",
    serverNow: "2026-11-18T03:00:00.000Z",
  };

  it("relatório do turno fechado", () => {
    expect(sessionReportView(report)).toEqual({
      id: "s1",
      status: "CLOSED",
      businessDay: "2026-11-17",
      restaurantName: "Cantina",
      timezone: "America/Sao_Paulo",
      openedAt: at.toISOString(),
      openedByName: "Ana",
      openingFloat: "150.00",
      previousKept: "180.00",
      openingNote: "Gás",
      closedAt: at.toISOString(),
      closedByName: "Bruno",
      receivedByMethod: [{ method: "CASH", amount: "77.00" }],
      received: "77.00",
      removedFromOtherSessions: [{ method: "PIX", amount: "30.00" }],
      serviceCharge: "10.70",
      entries: [entryView(entry)],
      counts: ["125.00"],
      steps: [{ key: "EXPECTED", sign: "=", amount: "127.00" }],
      expected: "127.00",
      counted: "125.00",
      difference: "-2.00",
      result: "SHORT",
      kept: "100.00",
      takenToSafe: "25.00",
      closeNote: "Troco errado",
    });
  });

  it("relatório do turno aberto sem o esperado: os campos continuam vazios", () => {
    const view = sessionReportView({
      ...report,
      status: "OPEN",
      previousKept: null,
      closedAt: null,
      steps: null,
      expected: null,
      counted: null,
      difference: null,
      result: null,
      kept: null,
      takenToSafe: null,
    });
    expect(view).toMatchObject({
      previousKept: null,
      closedAt: null,
      steps: null,
      expected: null,
      counted: null,
      difference: null,
      kept: null,
      takenToSafe: null,
    });
  });

  it("linha da lista de turnos, fechado e aberto", () => {
    const row: CashSessionRow = {
      id: "s1",
      businessDay: "2026-11-17",
      status: "CLOSED",
      openedAt: at,
      openedByName: "Ana",
      closedAt: at,
      closedByName: "Bruno",
      receivedByMethod: [],
      removedFromOtherSessions: [],
      received: d("117"),
      difference: d("-2"),
      result: "SHORT",
    };
    expect(sessionRowView(row)).toEqual({
      id: "s1",
      businessDay: "2026-11-17",
      status: "CLOSED",
      openedAt: at.toISOString(),
      openedByName: "Ana",
      closedAt: at.toISOString(),
      closedByName: "Bruno",
      received: "117.00",
      difference: "-2.00",
      result: "SHORT",
    });
    expect(
      sessionRowView({ ...row, status: "OPEN", closedAt: null, difference: null, result: null }),
    ).toMatchObject({ closedAt: null, difference: null, result: null });
  });
});
