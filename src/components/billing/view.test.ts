import { describe, it, expect } from "vitest";
import type { TabView } from "@/application/billing/tabs";
import { d } from "@/domain/shared/decimal";
import { tabDetailView } from "./view";

const at = (iso: string) => new Date(iso);

const tab: TabView = {
  id: "t1",
  tableId: "m1",
  tableName: "Mesa 4",
  restaurantName: "Cantina",
  timezone: "America/Sao_Paulo",
  status: "CLOSED",
  openedAt: at("2026-11-11T22:00:00Z"),
  closedAt: at("2026-11-11T23:30:00Z"),
  closedByName: "Ana",
  version: 3,
  orders: [
    {
      id: "o1",
      number: 7,
      status: "DELIVERED",
      cancelReason: null,
      cancelNote: null,
      total: d("56"),
      submittedAt: at("2026-11-11T22:05:00Z"),
      source: "STAFF",
      placedByName: "João",
      lines: [
        {
          quantity: 2,
          productName: "X-Burger",
          unitPrice: d("28"),
          changes: ["SEM cebola"],
          kitchenNote: null,
          recipeId: "x",
          addons: [],
          removals: [],
        },
      ],
    },
  ],
  subtotal: d("56"),
  serviceRate: d("0.1"),
  serviceWaived: false,
  serviceCharge: d("5.6"),
  total: d("61.6"),
  paid: d("61.6"),
  remaining: d("0"),
  pendingOrders: 0,
  canClose: true,
  blockers: [],
  payments: [
    {
      id: "p1",
      method: "CASH",
      amount: d("61.6"),
      received: d("70"),
      change: d("8.4"),
      at: at("2026-11-11T23:20:00Z"),
      byName: "Ana",
      removedAt: null,
      removedByName: null,
    },
    {
      id: "p2",
      method: "PIX",
      amount: d("10"),
      received: null,
      change: null,
      at: at("2026-11-11T23:10:00Z"),
      byName: null,
      removedAt: at("2026-11-11T23:15:00Z"),
      removedByName: "Bruno",
    },
  ],
  events: [{ kind: "CLOSED", reason: null, details: null, userName: "Ana", at: at("2026-11-11T23:30:00Z") }],
  cashSessionOpen: true,
  serverNow: "2026-11-11T23:31:00.000Z",
};

describe("conta para a tela", () => {
  it("dinheiro em texto com 2 casas, taxa como veio e datas em ISO", () => {
    const v = tabDetailView(tab);
    expect(v).toMatchObject({
      tableName: "Mesa 4",
      openedAt: "2026-11-11T22:00:00.000Z",
      closedAt: "2026-11-11T23:30:00.000Z",
      subtotal: "56.00",
      serviceRate: "0.1",
      serviceCharge: "5.60",
      total: "61.60",
      paid: "61.60",
      remaining: "0.00",
    });
    expect(v.orders[0]).toMatchObject({
      total: "56.00",
      lines: [{ unitPrice: "28.00", changes: ["SEM cebola"] }],
    });
    expect(v.payments).toEqual([
      expect.objectContaining({ amount: "61.60", received: "70.00", change: "8.40", removedAt: null }),
      expect.objectContaining({
        amount: "10.00",
        received: null,
        change: null,
        removedAt: "2026-11-11T23:15:00.000Z",
        removedByName: "Bruno",
      }),
    ]);
    expect(v.events[0]!.at).toBe("2026-11-11T23:30:00.000Z");
  });

  it("conta aberta sem taxa: nulos continuam nulos", () => {
    const v = tabDetailView({
      ...tab,
      status: "OPEN",
      closedAt: null,
      closedByName: null,
      serviceRate: null,
    });
    expect(v.closedAt).toBeNull();
    expect(v.serviceRate).toBeNull();
  });
});
