// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Cart, type SubmitFn } from "./cart";
import { addToCart, type CartLine } from "./cart-state";

afterEach(cleanup);

const burger = {
  productId: "b",
  name: "X-Burger",
  basePrice: "28.00",
  quantity: 2,
  addons: [{ id: "q", name: "Fatia de queijo", price: "3.00", times: 2 }],
  removals: [{ kind: "ITEM" as const, id: "c", label: "Sem cebola" }],
};
const juice = { productId: "s", name: "Suco", basePrice: "9.00", quantity: 1, addons: [], removals: [] };

function Harness({ submit, initial }: { submit: SubmitFn; initial: CartLine[] }) {
  const [lines, setLines] = useState(initial);
  return <Cart lines={lines} onChange={setLines} submit={submit} />;
}
const start = (...l: (typeof burger | typeof juice)[]) => l.reduce<CartLine[]>((c, x) => addToCart(c, x), []);
const ok = { ok: true as const, data: { orderId: "o1", number: 7, total: "77.00", status: "RECEIVED" as const }, at: 1 };

describe("carrinho do celular (spec 009 US2, spec 010 US3)", () => {
  it("mostra linhas com as escolhas e o total; muda quantidade e tira linha", () => {
    render(<Harness submit={vi.fn()} initial={start(burger, juice)} />);
    expect(screen.getByText("+ 2 Fatia de queijo")).toBeTruthy();
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 77,00");
    fireEvent.click(screen.getByRole("button", { name: "Mais um Suco" }));
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 86,00");
    fireEvent.click(screen.getByRole("button", { name: "Tirar X-Burger do pedido" }));
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 18,00");
  });

  it("mesmo produto com escolhas diferentes fica em linhas separadas", () => {
    const lines = start(burger, { ...burger, quantity: 1, addons: [], removals: [] }, { ...burger, quantity: 1 });
    expect(lines.map((l) => l.quantity)).toEqual([3, 1]);
  });

  it("'Enviar pedido' fica indisponível com o pedido vazio", () => {
    render(<Harness submit={vi.fn()} initial={[]} />);
    expect(screen.getByRole("button", { name: "Enviar pedido" }).matches(":disabled")).toBe(true);
  });

  it("confirma com o resumo e envia; sucesso limpa o carrinho", async () => {
    const submit = vi.fn<SubmitFn>().mockResolvedValue(ok);
    render(<Harness submit={submit} initial={start(burger, juice)} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    const summary = screen.getByRole("dialog", { name: "Confira o pedido" });
    expect(summary.textContent).toContain("R$ 77,00");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Pedido enviado para a cozinha")).toBeTruthy();
    expect(screen.getByText(/Pedido nº 7/)).toBeTruthy();
    const sent = submit.mock.calls[0]![0];
    expect(sent.lines).toEqual([
      {
        recipeId: "b",
        quantity: 2,
        unitPrice: "34.00",
        addons: [{ addonId: "q", times: 2, unitPrice: "3.00" }],
        removals: [{ kind: "ITEM", id: "c" }],
      },
      { recipeId: "s", quantity: 1, unitPrice: "9.00", addons: [], removals: [] },
    ]);
    expect(screen.getByRole("button", { name: "Enviar pedido" }).matches(":disabled")).toBe(true);
  });

  it("nova tentativa depois de falha reusa o mesmo clientRequestId", async () => {
    const submit = vi
      .fn<SubmitFn>()
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce(ok);
    render(<Harness submit={submit} initial={start(juice)} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText(/Não deu para enviar/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByText("Pedido enviado para a cozinha");
    expect(submit.mock.calls[0]![0].clientRequestId).toBe(submit.mock.calls[1]![0].clientRequestId);
  });

  it("preço mudado: avisa, atualiza o carrinho e pede nova confirmação", async () => {
    const submit = vi.fn<SubmitFn>().mockResolvedValueOnce({
      ok: false,
      error: {
        code: "PRICE_CHANGED",
        message: "x",
        details: { prices: [{ recipeId: "s", price: "10.00" }], addonPrices: [] },
      },
      at: 1,
    });
    render(<Harness submit={submit} initial={start(juice)} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("O preço de Suco mudou para R$ 10,00.")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Confira o pedido" }).textContent).toContain("R$ 10,00");
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 10,00");
  });

  it("produto indisponível: avisa e tira do carrinho", async () => {
    const submit = vi.fn<SubmitFn>().mockResolvedValueOnce({
      ok: false,
      error: { code: "PRODUCT_UNAVAILABLE", message: "x", details: { recipeIds: ["s"], addonIds: [] } },
      at: 1,
    });
    render(<Harness submit={submit} initial={start(burger, juice)} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Suco não está mais disponível.")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("cart-total").textContent).toBe("R$ 68,00"));
  });
});
