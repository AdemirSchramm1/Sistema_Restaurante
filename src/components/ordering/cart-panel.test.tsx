// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CartPanel } from "./cart-panel";
import { addToCart, type CartLine } from "./cart-state";
import type { SubmitFn } from "./cart";

afterEach(cleanup);

const burger = {
  productId: "b",
  name: "X-Burger",
  basePrice: "28.00",
  quantity: 1,
  addons: [{ id: "q", name: "Fatia de queijo", price: "3.00", times: 2 }],
  removals: [{ kind: "ITEM" as const, id: "c", label: "Sem cebola" }],
};
const juice = { productId: "s", name: "Suco", basePrice: "9.00", quantity: 1, addons: [], removals: [] };

function Harness({
  initial,
  highlight = null,
  submit = vi.fn<SubmitFn>(),
}: {
  initial: CartLine[];
  highlight?: string | null;
  submit?: SubmitFn;
}) {
  const [lines, setLines] = useState(initial);
  return <CartPanel lines={lines} onChange={setLines} submit={submit} highlight={highlight} />;
}
const start = (...l: (typeof burger | typeof juice)[]) => l.reduce<CartLine[]>((c, x) => addToCart(c, x), []);

describe("carrinho sempre à vista (spec 016, US3-1, FR-003)", () => {
  it("coluna ao lado na tela larga: título, linhas com as escolhas, total e Enviar pedido no pé", () => {
    render(<Harness initial={start(burger, juice)} />);
    const panel = screen.getByTestId("cart-panel");
    expect(panel.className).toContain("lg:sticky");
    expect(panel.className).toContain("lg:flex");
    const cart = within(panel).getByRole("region", { name: "Seu pedido" });
    expect(within(cart).getByRole("heading", { name: "Seu pedido" })).toBeTruthy();
    expect(within(cart).getByText("+ 2 Fatia de queijo")).toBeTruthy();
    expect(
      within(cart).getByText((_, el) => el?.tagName === "LI" && el.textContent === "SEM cebola"),
    ).toBeTruthy();
    expect(within(cart).getByTestId("cart-total").textContent).toBe("R$ 43,00");
    // Só a lista rola; o total e o botão ficam no pé.
    expect(within(cart).getAllByRole("list")[0]!.className).toContain("overflow-y-auto");
    const send = within(cart).getByRole("button", { name: "Enviar pedido" });
    expect(send.closest("[data-cart-foot]")).toBeTruthy();
    for (const name of ["Menos um X-Burger", "Mais um X-Burger", "Tirar X-Burger do pedido"])
      expect(within(cart).getByRole("button", { name })).toBeTruthy();
  });

  it("vazio: diz o que fazer", () => {
    render(<Harness initial={[]} />);
    expect(screen.getByText("Escolha os pratos e eles aparecem aqui.")).toBeTruthy();
  });

  it("na tela estreita fica escondido; a barra abre por cima com foco no título e fecha com Esc", () => {
    render(<Harness initial={start(juice)} />);
    const panel = screen.getByTestId("cart-panel");
    expect(panel.className).toContain("hidden");
    fireEvent.click(screen.getByRole("button", { name: /^Ver pedido/ }));
    expect(panel.className).not.toMatch(/(^| )hidden( |$)/);
    expect(panel.className).toContain("fixed");
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(document.activeElement).toBe(within(panel).getByRole("heading", { name: "Seu pedido" }));
    expect(screen.queryByRole("button", { name: /^Ver pedido/ })).toBeNull();
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(panel.className).toMatch(/(^| )hidden( |$)/);
    fireEvent.click(screen.getByRole("button", { name: /^Ver pedido/ }));
    fireEvent.click(within(panel).getByRole("button", { name: "Voltar ao cardápio" }));
    expect(panel.className).toMatch(/(^| )hidden( |$)/);
  });

  it("a página reserva a altura da barra quando há algo no carrinho", () => {
    const { rerender } = render(<CartPanel lines={[]} onChange={() => {}} submit={null} highlight={null} />);
    expect(screen.queryByTestId("cart-bar-space")).toBeNull();
    rerender(<CartPanel lines={start(juice)} onChange={() => {}} submit={null} highlight={null} />);
    expect(screen.getByTestId("cart-bar-space").className).toContain("lg:hidden");
  });

  it("a linha que acabou de mudar fica destacada", () => {
    const lines = start(burger, juice);
    render(<Harness initial={lines} highlight={lines[1]!.key} />);
    const rows = [...screen.getAllByRole("list")[0]!.children];
    expect(rows[1]!.hasAttribute("data-highlight")).toBe(true);
    expect(rows[0]!.hasAttribute("data-highlight")).toBe(false);
  });

  it("esvaziar o carrinho com ele aberto por cima fecha", () => {
    render(<Harness initial={start(juice)} />);
    fireEvent.click(screen.getByRole("button", { name: /^Ver pedido/ }));
    act(() => fireEvent.click(screen.getByRole("button", { name: "Tirar Suco do pedido" })));
    expect(screen.getByTestId("cart-panel").className).toMatch(/(^| )hidden( |$)/);
  });

  it("na tela estreita, depois de enviar, o aviso 'Pedido enviado' fica à vista até voltar ao cardápio", async () => {
    const submit = vi.fn<SubmitFn>(async () => ({
      ok: true,
      data: { orderId: "o1", number: 4, total: "9.00", status: "RECEIVED" },
      at: 1,
    }));
    render(<Harness initial={start(juice)} submit={submit} />);
    fireEvent.click(screen.getByRole("button", { name: /^Ver pedido/ }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    });
    const panel = screen.getByTestId("cart-panel");
    expect(panel.className).not.toMatch(/(^| )hidden( |$)/);
    expect(within(panel).getByRole("status").textContent).toContain("Pedido nº 4");
    fireEvent.click(within(panel).getByRole("button", { name: "Voltar ao cardápio" }));
    expect(panel.className).toMatch(/(^| )hidden( |$)/);
  });
});
