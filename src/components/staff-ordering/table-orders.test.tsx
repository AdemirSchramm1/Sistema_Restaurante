// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { TableOrdersView, TableOrderView } from "@/application/ordering/staff-orders";
import { TableOrders } from "./table-orders";

afterEach(cleanup);

const noop = async () => null;
const order = (over: Partial<TableOrderView> = {}): TableOrderView => ({
  id: "o1",
  number: 4,
  submittedAt: "2026-11-17T23:10:00.000Z",
  source: "STAFF",
  placedById: "joao",
  placedByName: "João",
  status: "RECEIVED",
  total: "30.00",
  version: 1,
  canCancel: false,
  canDeliver: false,
  lines: [
    {
      quantity: 1,
      productName: "X-Burger",
      changes: ["SEM cebola"],
      kitchenNote: "mal passado",
      again: { recipeId: "x", quantity: 1, addons: [], removals: [], kitchenNote: "mal passado" },
    },
  ],
  ...over,
});
const view = (orders: TableOrderView[]): TableOrdersView => ({
  table: { id: "m12", name: "12" },
  tab: {
    id: "t",
    subtotal: "30.00",
    serviceCharge: "0.00",
    total: "30.00",
    paid: "0.00",
    remaining: "30.00",
  },
  orders,
});
const show = (v: TableOrdersView, onAgain = vi.fn(), locked = false) =>
  render(
    <TableOrders
      view={v}
      userId="joao"
      timezone="America/Sao_Paulo"
      deliver={noop}
      cancel={noop}
      onAgain={onAgain}
      locked={locked}
    />,
  );

describe("Pedidos da mesa (spec 015, US3, US4, US6)", () => {
  it("mesa sem conta aberta", () => {
    show({ table: { id: "m12", name: "12" }, tab: null, orders: [] });
    expect(screen.getByText("Nenhum pedido aberto nesta mesa.")).toBeTruthy();
  });

  it("número, hora, quem lançou, situação, observação; sem taxa não mostra a linha", () => {
    show(view([order()]));
    const card = screen.getByRole("article", { name: "Pedido 4" });
    expect(within(card).getByRole("heading").textContent).toBe("Pedido 4 · 20:10 · João");
    expect(within(card).getByText("Recebido")).toBeTruthy();
    expect(within(card).getByText(/mal passado/)).toBeTruthy();
    expect(screen.queryByText("Taxa de serviço")).toBeNull();
  });

  it("Pedir de novo por linha e pelo pedido; travado espera", () => {
    const onAgain = vi.fn();
    show(view([order()]), onAgain);
    fireEvent.click(screen.getByRole("button", { name: "Pedir de novo 1 X-Burger" }));
    expect(onAgain).toHaveBeenLastCalledWith([
      {
        recipeId: "x",
        quantity: 1,
        addons: [],
        removals: [],
        kitchenNote: "mal passado",
        productName: "X-Burger",
      },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Pedir de novo o pedido 4" }));
    expect(onAgain).toHaveBeenCalledTimes(2);
    cleanup();
    show(view([order()]), vi.fn(), true);
    expect(
      (screen.getByRole("button", { name: "Pedir de novo o pedido 4" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("Cancelar o próprio: motivo da lista, Outro pede o texto, Voltar fecha", () => {
    show(view([order({ canCancel: true })]));
    const card = screen.getByRole("article", { name: "Pedido 4" });
    fireEvent.click(within(card).getByRole("button", { name: "Cancelar" }));
    const reason = within(card).getByLabelText("Por que cancelar?") as HTMLSelectElement;
    expect(reason.value).toBe("ENTERED_BY_MISTAKE");
    expect(within(card).queryByLabelText("Qual o motivo?")).toBeNull();
    fireEvent.change(reason, { target: { value: "OTHER" } });
    expect(within(card).getByLabelText("Qual o motivo?")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Voltar" }));
    expect(within(card).queryByLabelText("Por que cancelar?")).toBeNull();
  });

  it("a cozinha já começou: só o chef ou o gerente cancelam", () => {
    show(
      view([
        order({ status: "PREPARING" }),
        order({
          id: "o2",
          number: 5,
          status: "READY",
          canDeliver: true,
          placedById: "maria",
          placedByName: "Maria",
        }),
      ]),
    );
    const four = screen.getByRole("article", { name: "Pedido 4" });
    expect(within(four).getByText(/A cozinha já começou/)).toBeTruthy();
    const five = screen.getByRole("article", { name: "Pedido 5" });
    expect(within(five).queryByText(/A cozinha já começou/)).toBeNull();
    expect(within(five).getByRole("button", { name: "Entregue" })).toBeTruthy();
  });

  it("cancelado vem riscado; QR code e taxa de serviço", () => {
    show({
      ...view([order({ status: "CANCELLED", source: "QR", placedById: null, placedByName: null })]),
      tab: {
        id: "t",
        subtotal: "30.00",
        serviceCharge: "3.00",
        total: "33.00",
        paid: "0.00",
        remaining: "33.00",
      },
    });
    const card = screen.getByRole("article", { name: "Pedido 4" });
    expect(within(card).getByRole("heading").className).toContain("line-through");
    expect(within(card).getByRole("heading").textContent).toContain("QR code");
    expect(screen.getByText("Taxa de serviço")).toBeTruthy();
  });
});
