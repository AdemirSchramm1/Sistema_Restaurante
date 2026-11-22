// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CartBar } from "./cart-bar";
import { addToCart, type CartLine } from "./cart-state";

afterEach(cleanup);

const line = (name: string, price: string, quantity: number) => ({
  productId: name,
  name,
  basePrice: price,
  quantity,
  addons: [],
  removals: [],
});
const lines = (...l: ReturnType<typeof line>[]) => l.reduce<CartLine[]>((c, x) => addToCart(c, x), []);

describe("barra do carrinho no pé (spec 016, US3-2)", () => {
  it("itens e total, com o plural certo; tocar abre o carrinho", () => {
    const onOpen = vi.fn();
    const { rerender } = render(
      <CartBar lines={lines(line("X-Burger", "40.00", 2), line("Suco", "18.00", 1))} onOpen={onOpen} />,
    );
    const bar = screen.getByRole("button", { name: "Ver pedido · 3 itens · R$ 98,00" });
    fireEvent.click(bar);
    expect(onOpen).toHaveBeenCalledTimes(1);
    rerender(<CartBar lines={lines(line("Suco", "9.00", 1))} onOpen={onOpen} />);
    expect(screen.getByRole("button", { name: "Ver pedido · 1 item · R$ 9,00" })).toBeTruthy();
  });

  it("presa no pé, some na tela larga e respeita a área segura do iPhone", () => {
    render(<CartBar lines={lines(line("Suco", "9.00", 1))} onOpen={() => {}} />);
    const wrap = screen.getByTestId("cart-bar");
    expect(wrap.className).toContain("fixed");
    expect(wrap.className).toContain("bottom-0");
    expect(wrap.className).toContain("lg:hidden");
    expect(wrap.className).toContain("pb-[calc(0.75rem+env(safe-area-inset-bottom))]");
    expect(screen.getByRole("button").className).toContain("min-h-12");
  });

  it("escondida com o carrinho vazio", () => {
    const { container } = render(<CartBar lines={[]} onOpen={() => {}} />);
    expect(container.innerHTML).toBe("");
  });
});
