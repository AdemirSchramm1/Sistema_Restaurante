// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MyOrders } from "./my-orders";

afterEach(cleanup);

describe("'Meus pedidos' (spec 009, US2)", () => {
  it("mostra a situação de cada pedido em português, com as mudanças", () => {
    render(
      <MyOrders
        orders={[
          {
            number: 2,
            submittedAt: "2026-11-08T20:10:00.000Z",
            status: "PREPARING",
            total: "18.00",
            lines: [{ quantity: 2, productName: "Suco", changes: [] }],
          },
          {
            number: 1,
            submittedAt: "2026-11-08T20:00:00.000Z",
            status: "READY",
            total: "68.00",
            lines: [{ quantity: 2, productName: "X-Burger", changes: ["SEM cebola"] }],
          },
        ]}
      />,
    );
    expect(screen.getByText("Em preparo")).toBeTruthy();
    expect(screen.getByText("Pronto")).toBeTruthy();
    expect(screen.getByText("Pedido nº 2")).toBeTruthy();
    expect(screen.getByText("R$ 68,00")).toBeTruthy();
    expect(screen.getAllByRole("listitem").some((li) => li.textContent === "SEM cebola")).toBe(true);
  });

  it("sem pedidos não mostra a seção", () => {
    const { container } = render(<MyOrders orders={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
