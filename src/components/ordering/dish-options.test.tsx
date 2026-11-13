// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DishOptions } from "./dish-options";
import type { MenuProduct } from "@/application/ordering/menu";

afterEach(cleanup);

const burger: MenuProduct = {
  id: "b",
  name: "X-Burger",
  price: "28.00",
  description: null,
  photo: null,
  addons: [
    { id: "q", name: "Fatia de queijo", price: "3.00", maxTimes: 2 },
    { id: "g", name: "Molho extra", price: "0.00", maxTimes: 1 },
  ],
  removables: [{ kind: "ITEM", id: "c", label: "Sem cebola" }],
};

describe("tela do prato com botões (spec 010, US3)", () => {
  it("+ e − contam o adicional e o + para no máximo", () => {
    render(<DishOptions product={burger} onAdd={vi.fn()} onClose={vi.fn()} />);
    const more = screen.getByRole("button", { name: "Mais Fatia de queijo" });
    const less = screen.getByRole("button", { name: "Menos Fatia de queijo" });
    expect(less.matches(":disabled")).toBe(true);
    fireEvent.click(more);
    fireEvent.click(more);
    expect(screen.getByLabelText("Quantidade de Fatia de queijo").textContent).toBe("2");
    expect(more.matches(":disabled")).toBe(true);
    fireEvent.click(less);
    expect(screen.getByLabelText("Quantidade de Fatia de queijo").textContent).toBe("1");
    expect(screen.getByText("Grátis")).toBeTruthy();
  });

  it("'Sem cebola' liga e desliga", () => {
    render(<DishOptions product={burger} onAdd={vi.fn()} onClose={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "Sem cebola" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("o preço do prato acompanha as escolhas e a quantidade", () => {
    render(<DishOptions product={burger} onAdd={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId("dish-total").textContent).toBe("R$ 28,00");
    fireEvent.click(screen.getByRole("button", { name: "Mais Fatia de queijo" }));
    fireEvent.click(screen.getByRole("button", { name: "Mais Fatia de queijo" }));
    expect(screen.getByTestId("dish-total").textContent).toBe("R$ 34,00");
    fireEvent.click(screen.getByRole("button", { name: "Mais um prato" }));
    expect(screen.getByTestId("dish-total").textContent).toBe("R$ 68,00");
  });

  it("não tem campo de texto e manda chamar o garçom para outra mudança", () => {
    render(<DishOptions product={burger} onAdd={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByText("Precisa de outra mudança? Chame um garçom.")).toBeTruthy();
  });

  it("'Adicionar ao pedido' leva as escolhas", () => {
    const onAdd = vi.fn();
    render(<DishOptions product={burger} onAdd={onAdd} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais Fatia de queijo" }));
    fireEvent.click(screen.getByRole("button", { name: "Sem cebola" }));
    fireEvent.click(screen.getByRole("button", { name: "Mais um prato" }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar ao pedido/ }));
    expect(onAdd).toHaveBeenCalledWith({
      productId: "b",
      name: "X-Burger",
      basePrice: "28.00",
      quantity: 2,
      addons: [{ id: "q", name: "Fatia de queijo", price: "3.00", times: 1 }],
      removals: [{ kind: "ITEM", id: "c", label: "Sem cebola" }],
    });
  });
});
