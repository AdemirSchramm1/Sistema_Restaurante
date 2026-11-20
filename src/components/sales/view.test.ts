import { describe, it, expect } from "vitest";
import { d } from "@/domain/shared/decimal";
import type { SalesReport } from "@/application/cash/sales";
import { salesReportView } from "./view";

describe("Vendas como a tela recebe", () => {
  it("dinheiro com 2 casas, parte com 1 casa, turnos como na lista de turnos", () => {
    const at = new Date("2026-10-31T14:02:00.000Z");
    const report: SalesReport = {
      byMethod: [{ method: "CASH", amount: d("78") }],
      removedFromOtherSessions: [{ method: "PIX", amount: d("10") }],
      received: d("78"),
      serviceCharge: d("3.4"),
      products: [{ recipeId: "r1", name: "X-Burger", quantity: 3, amount: d("94"), share: d("83.9") }],
      productsTotal: d("94"),
      addons: [{ addonId: "a1", name: "Fatia de queijo", times: 2, amount: d("4") }],
      sessions: [
        {
          id: "s1",
          businessDay: "2026-10-31",
          status: "OPEN",
          openedAt: at,
          openedByName: "Ana",
          closedAt: null,
          closedByName: null,
          receivedByMethod: [],
          removedFromOtherSessions: [],
          received: d("78"),
          difference: null,
          result: null,
        },
      ],
      differenceTotal: d(0),
      pendingOrders: 1,
      timezone: "America/Sao_Paulo",
    };
    expect(salesReportView(report, "2026-10-31", "2026-10-31")).toEqual({
      from: "2026-10-31",
      to: "2026-10-31",
      timezone: "America/Sao_Paulo",
      byMethod: [{ method: "CASH", amount: "78.00" }],
      removedFromOtherSessions: [{ method: "PIX", amount: "10.00" }],
      received: "78.00",
      serviceCharge: "3.40",
      products: [{ recipeId: "r1", name: "X-Burger", quantity: 3, amount: "94.00", share: "83.9" }],
      productsTotal: "94.00",
      addons: [{ addonId: "a1", name: "Fatia de queijo", times: 2, amount: "4.00" }],
      sessions: [
        {
          id: "s1",
          businessDay: "2026-10-31",
          status: "OPEN",
          openedAt: at.toISOString(),
          openedByName: "Ana",
          closedAt: null,
          closedByName: null,
          received: "78.00",
          difference: null,
          result: null,
        },
      ],
      differenceTotal: "0.00",
      pendingOrders: 1,
    });
  });
});
