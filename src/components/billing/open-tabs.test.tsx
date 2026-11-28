// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { OpenTabs } from "./open-tabs";

afterEach(cleanup);

const NOW = "2026-11-11T21:00:00.000Z";

describe("caixa: mesas com conta aberta (spec 011, US1)", () => {
  it("mostra a mesa, o total, há quanto tempo e os pedidos não entregues, com link para a conta", () => {
    render(
      <OpenTabs
        serverNow={NOW}
        tabs={[
          {
            id: "t12",
            tableName: "12",
            openedAt: "2026-11-11T20:25:00.000Z",
            total: "84.70",
            remaining: "84.70",
            pendingOrders: 2,
          },
          {
            id: "t3",
            tableName: "3",
            openedAt: "2026-11-11T20:59:00.000Z",
            total: "9.00",
            remaining: "0.00",
            pendingOrders: 1,
          },
        ]}
      />,
    );
    const mesa12 = screen.getByRole("link", { name: /Mesa 12/ });
    expect(mesa12.getAttribute("href")).toBe("/caixa/t12");
    expect(within(mesa12).getByText("R$ 84,70")).toBeTruthy();
    expect(within(mesa12).getByText("há 35 min")).toBeTruthy();
    expect(within(mesa12).getByText("2 pedidos ainda não foram entregues")).toBeTruthy();
    const mesa3 = screen.getByRole("link", { name: /Mesa 3/ });
    expect(within(mesa3).getByText("1 pedido ainda não foi entregue")).toBeTruthy();
    expect(within(mesa3).getByText("Pago")).toBeTruthy();
  });

  it("sem conta aberta diz isso", () => {
    render(<OpenTabs serverNow={NOW} tabs={[]} />);
    expect(screen.getByText("Nenhuma mesa com conta aberta.")).toBeTruthy();
  });

  it("diz quanto falta, se pagaram a mais, e nada sobre a cozinha quando tudo foi entregue (spec 018)", () => {
    const card = (id: string, total: string, remaining: string) => ({
      id,
      tableName: id,
      openedAt: NOW,
      total,
      remaining,
      pendingOrders: 0,
    });
    render(<OpenTabs serverNow={NOW} tabs={[card("4", "84.70", "30.00"), card("5", "20.00", "-5.00")]} />);
    const mesa4 = screen.getByRole("link", { name: /Mesa 4/ });
    expect(within(mesa4).getByText("Falta R$ 30,00")).toBeTruthy();
    expect(within(mesa4).queryByText(/entregue/)).toBeNull();
    expect(within(screen.getByRole("link", { name: /Mesa 5/ })).getByText("Pago a mais")).toBeTruthy();
  });
});
