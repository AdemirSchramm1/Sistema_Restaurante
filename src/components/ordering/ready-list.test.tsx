// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ReadyList } from "./ready-list";

afterEach(cleanup);

describe("tela do garçom (spec 009 US4)", () => {
  it("mostra a mesa em destaque e o botão 'Entregue'", () => {
    render(
      <ReadyList
        deliver={async () => null}
        orders={[
          {
            id: "o1",
            number: 4,
            tableName: "12",
            readyAt: "2026-11-08T20:00:00.000Z",
            version: 3,
            lines: [{ quantity: 1, productName: "X-Burger", changes: ["SEM cebola"] }],
          },
        ]}
      />,
    );
    const card = screen.getByRole("article", { name: "Mesa 12, pedido 4" });
    expect(within(card).getByRole("heading", { name: "Mesa 12" })).toBeTruthy();
    expect(within(card).getByText("1 × X-Burger")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Entregue" })).toBeTruthy();
  });

  it("sem pedidos prontos diz que não há nada para levar", () => {
    render(<ReadyList deliver={async () => null} orders={[]} />);
    expect(screen.getByText("Nenhum pedido pronto para levar.")).toBeTruthy();
  });
});
