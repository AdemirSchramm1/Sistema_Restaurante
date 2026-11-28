// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { TabPrint } from "./tab-print";
import type { TabDetailView } from "./tab-detail";

afterEach(cleanup);

const tab: TabDetailView = {
  id: "t12",
  tableName: "12",
  status: "OPEN",
  openedAt: "2026-11-11T20:25:00.000Z",
  closedAt: null,
  closedByName: null,
  orders: [
    {
      id: "o7",
      number: 7,
      status: "DELIVERED",
      cancelReason: null,
      cancelNote: null,
      total: "68.00",
      lines: [
        {
          quantity: 2,
          productName: "X-Burger",
          unitPrice: "34.00",
          changes: ["+ 2 Fatia de queijo", "SEM cebola"],
        },
      ],
    },
    {
      id: "o8",
      number: 8,
      status: "DELIVERED",
      cancelReason: null,
      cancelNote: null,
      total: "9.00",
      lines: [{ quantity: 1, productName: "Suco de laranja", unitPrice: "9.00", changes: [] }],
    },
    {
      id: "o9",
      number: 9,
      status: "CANCELLED",
      cancelReason: "CUSTOMER_GAVE_UP",
      cancelNote: null,
      total: "12.00",
      lines: [{ quantity: 1, productName: "Pudim", unitPrice: "12.00", changes: [] }],
    },
  ],
  subtotal: "77.00",
  serviceRate: "10",
  serviceWaived: false,
  serviceCharge: "7.70",
  total: "84.70",
  paid: "0.00",
  remaining: "84.70",
  pendingOrders: 0,
  blockers: ["REMAINING_NOT_ZERO"],
  payments: [],
  events: [],
};

const props = {
  tab,
  restaurantName: "Restaurante Sabor",
  timezone: "America/Sao_Paulo",
  printedAt: "2026-11-11T21:10:00.000Z",
};

describe("conta impressa (spec 011, US1-9)", () => {
  it("restaurante, mesa, data, linhas com as mudanças e o valor de cada linha", () => {
    render(<TabPrint {...props} />);
    expect(screen.getByRole("heading", { name: "Restaurante Sabor" })).toBeTruthy();
    expect(screen.getByText("Mesa 12")).toBeTruthy();
    expect(screen.getByText("11/11/2026 18:10")).toBeTruthy();
    const lines = screen.getAllByRole("listitem").filter((li) => li.querySelector("[data-line]"));
    expect(lines.map((li) => li.querySelector("[data-line]")?.textContent)).toEqual([
      "2 × X-BurgerR$ 68,00",
      "1 × Suco de laranjaR$ 9,00",
    ]);
    expect(within(lines[0]!).getByText("+ 2 Fatia de queijo")).toBeTruthy();
    expect(within(lines[0]!).getByText("SEM").parentElement?.textContent).toBe("SEM cebola");
  });

  it("pedido cancelado não sai na conta impressa", () => {
    render(<TabPrint {...props} />);
    expect(screen.queryByText(/Pudim/)).toBeNull();
  });

  it("subtotal, taxa, total e o aviso de que não é documento fiscal", () => {
    render(<TabPrint {...props} />);
    const rows = screen.getAllByRole("row").map((r) => r.textContent);
    expect(rows).toEqual(["SubtotalR$ 77,00", "Serviço 10%R$ 7,70", "TotalR$ 84,70"]);
    expect(screen.getByText("Não é documento fiscal")).toBeTruthy();
  });

  it("já pago aparece com o que falta; sem taxa não sai a linha do serviço", () => {
    render(
      <TabPrint
        {...props}
        tab={{
          ...tab,
          serviceRate: null,
          serviceCharge: "0.00",
          total: "77.00",
          paid: "50.00",
          remaining: "27.00",
        }}
      />,
    );
    const rows = screen.getAllByRole("row").map((r) => r.textContent);
    expect(rows).toEqual(["SubtotalR$ 77,00", "TotalR$ 77,00", "PagoR$ 50,00", "FaltaR$ 27,00"]);
  });

  it("taxa tirada sai marcada; pago a mais não mostra falta negativa (spec 018)", () => {
    render(
      <TabPrint
        {...props}
        tab={{
          ...tab,
          serviceWaived: true,
          serviceCharge: "0.00",
          total: "77.00",
          paid: "80.00",
          remaining: "-3.00",
        }}
      />,
    );
    const rows = screen.getAllByRole("row").map((r) => r.textContent);
    expect(rows).toEqual([
      "SubtotalR$ 77,00",
      "Serviço 10% (tirado)R$ 0,00",
      "TotalR$ 77,00",
      "PagoR$ 80,00",
      "FaltaR$ 0,00",
    ]);
  });
});
