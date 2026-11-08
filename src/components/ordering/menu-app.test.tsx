// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MenuApp } from "./menu-app";
import type { MenuView } from "@/application/ordering/menu";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

const menu: MenuView = {
  restaurantName: "Cantina da Nona",
  tableName: "5",
  serverNow: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
  ordersLeft: 10,
  products: [
    { id: "s", name: "Suco", price: "9.00", addons: [], removables: [] },
    {
      id: "b",
      name: "X-Burger",
      price: "28.00",
      addons: [{ id: "q", name: "Fatia de queijo", price: "3.00", maxTimes: 2 }],
      removables: [{ kind: "ITEM", id: "c", label: "Sem cebola" }],
    },
  ],
};

describe("cardápio do celular (spec 009 US2, spec 010 US3)", () => {
  it("mostra o restaurante, a mesa e os produtos", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    expect(screen.getByText("Cantina da Nona")).toBeTruthy();
    expect(screen.getByText("Mesa 5")).toBeTruthy();
    expect(screen.getByText("R$ 28,00")).toBeTruthy();
  });

  it("produto sem opções vai direto para o pedido", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Suco" }));
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 9,00");
  });

  it("produto com opções abre a tela do prato", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar X-Burger" }));
    const dish = screen.getByRole("region", { name: "X-Burger" });
    fireEvent.click(within(dish).getByRole("button", { name: "Sem cebola" }));
    fireEvent.click(within(dish).getByRole("button", { name: "Adicionar ao pedido" }));
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 28,00");
    expect(screen.getAllByRole("listitem").some((li) => li.textContent === "SEM cebola")).toBe(true);
  });

  it("busca pelo nome sem acento", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Buscar no cardápio"), { target: { value: "burg" } });
    expect(screen.queryByRole("button", { name: "Adicionar Suco" })).toBeNull();
    expect(screen.getByRole("button", { name: "Adicionar X-Burger" })).toBeTruthy();
  });

  it("sem pedidos restantes no acesso, pede para chamar o garçom", () => {
    render(<MenuApp menu={{ ...menu, ordersLeft: 0 }} orders={[]} submit={vi.fn()} />);
    expect(screen.getByText("Chame um garçom para continuar pedindo.")).toBeTruthy();
  });
});
