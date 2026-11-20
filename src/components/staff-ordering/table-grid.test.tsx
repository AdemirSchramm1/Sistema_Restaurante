// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { TableGrid } from "./table-grid";
import { cartKey, saveCart } from "./cart-storage";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const tables = [
  { id: "m4", name: "4", tab: null, readyCount: 0 },
  {
    id: "m12",
    name: "12",
    tab: { id: "t", openedAt: "2026-11-17T20:00:00Z", total: "120.00" },
    readyCount: 2,
  },
];
const grid = (over: Partial<Parameters<typeof TableGrid>[0]> = {}) =>
  render(
    <TableGrid
      tables={tables}
      qrOrdersOff={false}
      restaurantId="r1"
      userId="joao"
      serverNow="2026-11-17T20:35:00Z"
      {...over}
    />,
  );

describe("grade de mesas do garçom (spec 015, US1-1, US5-4)", () => {
  it("livre, ocupada com o total e há quanto tempo, prontos; link para a mesa", () => {
    grid();
    const list = screen.getByRole("list", { name: "Mesas" });
    const twelve = within(list).getByRole("link", { name: /Mesa 12/ });
    expect(twelve.textContent).toContain("Ocupada · R$ 120,00 · há 35 min");
    expect(twelve.textContent).toContain("2 prontos");
    expect(twelve.getAttribute("href")).toBe("/pedidos/lancar/m12");
    expect(within(list).getByRole("link", { name: /Mesa 4/ }).textContent).toContain("Livre");
    expect(screen.queryByText(/QR code está desligado/)).toBeNull();
  });

  it("busca pelo nome da mesa", () => {
    grid();
    fireEvent.change(screen.getByLabelText("Buscar mesa"), { target: { value: "12" } });
    expect(screen.getAllByRole("link")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Buscar mesa"), { target: { value: "99" } });
    expect(screen.getByText("Nenhuma mesa com esse nome.")).toBeTruthy();
  });

  it("marca a mesa com carrinho não enviado neste aparelho e apaga os de outro garçom", () => {
    const line = {
      key: "x",
      productId: "x",
      name: "X",
      basePrice: "1.00",
      quantity: 3,
      addons: [],
      removals: [],
    };
    const cart = {
      lines: [line],
      clientRequestId: "c",
      tabIdSeen: null,
      savedAt: Date.now(),
      send: { state: "idle" as const },
    };
    saveCart(localStorage, cartKey("r1", "joao", "m4"), cart);
    saveCart(localStorage, cartKey("r1", "maria", "m12"), cart);
    grid({ tables: [{ ...tables[0]!, readyCount: 1 }, tables[1]!] });
    expect(screen.getByRole("link", { name: /Mesa 4/ }).textContent).toContain("Carrinho: 3 itens");
    expect(screen.getByRole("link", { name: /Mesa 4/ }).textContent).toContain("1 pronto");
    expect(screen.getByRole("link", { name: /Mesa 12/ }).textContent).not.toContain("Carrinho");
    expect(localStorage.getItem(cartKey("r1", "maria", "m12"))).toBeNull();
  });

  it("avisa quando o QR code está desligado", () => {
    grid({ qrOrdersOff: true });
    expect(screen.getByText("O QR code está desligado: só a equipe lança pedidos.")).toBeTruthy();
  });

  it("no servidor não conta carrinho nenhum (o aparelho só é lido no navegador)", async () => {
    const { renderToString } = await import("react-dom/server");
    const html = renderToString(
      <TableGrid
        tables={tables}
        qrOrdersOff={false}
        restaurantId="r1"
        userId="joao"
        serverNow="2026-11-17T20:35:00Z"
      />,
    );
    expect(html).toContain("/pedidos/lancar/m12");
    expect(html).not.toContain("Carrinho");
  });
});
