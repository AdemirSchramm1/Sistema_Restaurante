// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { StaffMenuView, TableOrdersView } from "@/application/ordering/staff-orders";
import { TableScreen, type PlaceFn } from "./table-screen";
import { cartKey, loadCart, saveCart } from "./cart-storage";
import { UNCERTAIN_TEXT } from "./send-state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => localStorage.clear());

const menu: StaffMenuView = {
  table: { id: "m12", name: "12" },
  tab: null,
  qrOrdersOff: false,
  showSectionTitles: false,
  sections: [
    {
      id: null,
      name: "Outros",
      products: [
        {
          id: "chope",
          name: "Chope",
          price: "12.00",
          description: null,
          photo: null,
          addons: [],
          removables: [],
          soldOut: false,
        },
        {
          id: "pure",
          name: "Purê de batata",
          price: "18.00",
          description: null,
          photo: null,
          addons: [],
          removables: [{ kind: "ITEM", id: "sal", label: "Sem sal" }],
          soldOut: false,
        },
        {
          id: "pudim",
          name: "Pudim",
          price: "9.00",
          description: null,
          photo: null,
          addons: [],
          removables: [],
          soldOut: true,
        },
      ],
    },
  ],
};
const noOrders: TableOrdersView = { table: { id: "m12", name: "12" }, tab: null, orders: [] };
const key = cartKey("r1", "joao", "m12");
const noop = async () => null;

const screenWith = (place: PlaceFn, over: Partial<Parameters<typeof TableScreen>[0]> = {}) =>
  render(
    <TableScreen
      menu={menu}
      orders={noOrders}
      restaurantId="r1"
      userId="joao"
      timezone="America/Sao_Paulo"
      serverNow={new Date().toISOString()}
      place={place}
      deliver={noop}
      cancel={noop}
      {...over}
    />,
  );

const sent = { orderId: "o", number: 5, total: "24.00", tableName: "12", previousTabClosed: false };

const toCart = () => fireEvent.click(screen.getByRole("button", { name: /^Carrinho ·/ }));

describe("mesa no Lançar pedido (spec 015, US1, US3 a US6)", () => {
  it("Lista com + e −, esgotado no fim sem botão, barra do carrinho com total", () => {
    screenWith(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "Lista" }));
    expect(localStorage.getItem("garcom:modo")).toBe("lista");
    fireEvent.click(screen.getByRole("button", { name: "Mais um Chope" }));
    fireEvent.click(screen.getByRole("button", { name: "Mais um Chope" }));
    expect(screen.getByLabelText("No carrinho: Chope").textContent).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Menos um Chope" }));
    expect(screen.getByRole("button", { name: /^Carrinho ·/ }).textContent).toBe("Carrinho · 1 itemR$ 12,00");
    expect(screen.queryByRole("button", { name: "Mais um Pudim" })).toBeNull();
    expect(screen.getByText("Esgotado hoje")).toBeTruthy();
  });

  it("busca sem acento", () => {
    screenWith(vi.fn());
    fireEvent.change(screen.getByLabelText("Buscar no cardápio"), { target: { value: "pure" } });
    expect(screen.getByText("Purê de batata")).toBeTruthy();
    expect(screen.queryByText("Chope")).toBeNull();
    fireEvent.change(screen.getByLabelText("Buscar no cardápio"), { target: { value: "xis" } });
    expect(screen.getByText("Nada com esse nome.")).toBeTruthy();
  });

  it("tela do prato com observação para a cozinha", () => {
    screenWith(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "Ver Purê de batata" }));
    fireEvent.change(screen.getByLabelText("Observação para a cozinha"), { target: { value: "bem quente" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao pedido" }));
    toCart();
    const cart = screen.getByRole("region", { name: "Carrinho" });
    expect(within(cart).getByText(/bem quente/)).toBeTruthy();
  });

  it("confere e envia: o carrinho esvazia e some do aparelho", async () => {
    const place = vi.fn<PlaceFn>(async () => ({ ok: true, data: sent, at: 1 }));
    screenWith(place);
    fireEvent.click(screen.getByRole("button", { name: "Mais um Chope" }));
    fireEvent.click(screen.getByRole("button", { name: "Mais um Chope" }));
    expect(loadCart(localStorage, key, Date.now())?.lines).toHaveLength(1);
    toCart();
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    const dialog = screen.getByRole("dialog", { name: "Conferir: Mesa 12" });
    expect(within(dialog).getByText("2 × Chope")).toBeTruthy();
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" })));
    expect(place).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: "m12",
        lines: [expect.objectContaining({ recipeId: "chope", quantity: 2 })],
      }),
    );
    expect(screen.getByText("Pedido 5 enviado para a cozinha")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Carrinho ·/ })).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("resposta não veio: trava, guarda e Enviar de novo usa o mesmo envio", async () => {
    const place = vi
      .fn<PlaceFn>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true, data: sent, at: 1 });
    screenWith(place);
    fireEvent.click(screen.getByRole("button", { name: "Mais um Chope" }));
    toCart();
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirmar" })));
    expect(screen.getByText(UNCERTAIN_TEXT)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Mais um Chope" }) as HTMLButtonElement).disabled).toBe(true);
    expect(loadCart(localStorage, key, Date.now())?.send.state).toBe("uncertain");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Enviar de novo" })));
    const [first, second] = place.mock.calls.map(
      (c) => (c[0] as { clientRequestId: string }).clientRequestId,
    );
    expect(second).toBe(first);
    expect(screen.getByText("Pedido 5 enviado para a cozinha")).toBeTruthy();
  });

  it("carrinho travado volta travado ao abrir a mesa de novo", () => {
    const line = {
      key: "chope",
      productId: "chope",
      name: "Chope",
      basePrice: "12.00",
      quantity: 1,
      addons: [],
      removals: [],
    };
    saveCart(localStorage, key, {
      lines: [line],
      clientRequestId: "c1",
      tabIdSeen: null,
      savedAt: Date.now(),
      send: { state: "uncertain", pendingSince: Date.now() },
    });
    screenWith(vi.fn());
    expect(screen.getByText(UNCERTAIN_TEXT)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver carrinho" }));
    expect(screen.getByRole("button", { name: "Enviar de novo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver Pedidos da mesa" })).toBeTruthy();
  });

  it("recusado: o carrinho continua e mostra o motivo", async () => {
    const place = vi.fn<PlaceFn>(async () => ({
      ok: false,
      error: { code: "STAFF_TABLE_INACTIVE", message: "A Mesa 12 foi inativada. Fale com o gerente." },
      at: 1,
    }));
    screenWith(place);
    fireEvent.click(screen.getByRole("button", { name: "Mais um Chope" }));
    toCart();
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirmar" })));
    expect(screen.getByText("A Mesa 12 foi inativada. Fale com o gerente.")).toBeTruthy();
    expect(screen.getByLabelText("Quantidade de Chope").textContent).toBe("1");
    expect((screen.getByRole("button", { name: "Enviar pedido" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("sem rede: não envia", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const place = vi.fn<PlaceFn>();
    screenWith(place);
    fireEvent.click(screen.getByRole("button", { name: "Mais um Chope" }));
    toCart();
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect(screen.getByText("Sem conexão. O pedido não foi enviado.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(place).not.toHaveBeenCalled();
  });

  it("aviso de pedido parecido: Lançar mesmo assim", () => {
    const orders: TableOrdersView = {
      table: { id: "m12", name: "12" },
      tab: {
        id: "t",
        subtotal: "12.00",
        serviceCharge: "1.20",
        total: "13.20",
        paid: "0.00",
        remaining: "13.20",
      },
      orders: [
        {
          id: "o1",
          number: 4,
          submittedAt: new Date(Date.now() - 60_000).toISOString(),
          source: "STAFF",
          placedById: "maria",
          placedByName: "Maria",
          status: "RECEIVED",
          total: "12.00",
          version: 1,
          canCancel: false,
          canDeliver: false,
          lines: [
            {
              quantity: 1,
              productName: "Chope",
              changes: [],
              kitchenNote: null,
              again: { recipeId: "chope", quantity: 1, addons: [], removals: [], kitchenNote: null },
            },
          ],
        },
      ],
    };
    screenWith(vi.fn(), { orders });
    fireEvent.click(screen.getByRole("button", { name: "Mais um Chope" }));
    toCart();
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Maria lançou 1 Chope nesta mesa há 1 min/)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Lançar mesmo assim" })).toBeTruthy();
  });

  it("Pedidos da mesa: Pedir de novo põe no carrinho; esgotado fica de fora com aviso", () => {
    const orders: TableOrdersView = {
      table: { id: "m12", name: "12" },
      tab: {
        id: "t",
        subtotal: "21.00",
        serviceCharge: "2.10",
        total: "23.10",
        paid: "0.00",
        remaining: "23.10",
      },
      orders: [
        {
          id: "o1",
          number: 4,
          submittedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
          source: "QR",
          placedById: null,
          placedByName: null,
          status: "DELIVERED",
          total: "21.00",
          version: 3,
          canCancel: false,
          canDeliver: false,
          lines: [
            {
              quantity: 1,
              productName: "Chope",
              changes: [],
              kitchenNote: null,
              again: { recipeId: "chope", quantity: 1, addons: [], removals: [], kitchenNote: null },
            },
            {
              quantity: 1,
              productName: "Pudim",
              changes: [],
              kitchenNote: null,
              again: { recipeId: "pudim", quantity: 1, addons: [], removals: [], kitchenNote: null },
            },
          ],
        },
      ],
    };
    screenWith(vi.fn(), { orders, initialView: "orders" });
    expect(screen.getByText("Total da conta")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver conta" }).getAttribute("href")).toBe("/caixa/t");
    fireEvent.click(screen.getByRole("button", { name: "Pedir de novo o pedido 4" }));
    const cart = screen.getByRole("region", { name: "Carrinho" });
    expect(within(cart).getByLabelText("Quantidade de Chope").textContent).toBe("1");
    expect(within(cart).getByText("Pudim está esgotado hoje e não entrou.")).toBeTruthy();
  });
});
