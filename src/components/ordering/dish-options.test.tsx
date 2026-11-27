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
    fireEvent.click(screen.getByRole("button", { name: "Menos um prato" }));
    expect(screen.getByTestId("dish-total").textContent).toBe("R$ 34,00");
    expect(screen.getByRole("button", { name: "Menos um prato" }).matches(":disabled")).toBe(true);
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

describe("tela do prato com foto e descrição (spec 013, US6)", () => {
  const withPhoto: MenuProduct = {
    ...burger,
    description: "Pão brioche e dois hambúrgueres.\nFeito na hora.",
    photo: { base: "/fotos/menu/abc", widths: [300, 600, 900, 1200] },
  };

  it("mostra a foto maior, sem espera, e a descrição inteira com as quebras de linha", () => {
    render(<DishOptions product={withPhoto} onAdd={vi.fn()} onClose={vi.fn()} />);
    const img = screen.getByRole("img", { name: "X-Burger" });
    expect(img.getAttribute("loading")).toBe("eager");
    expect(img.getAttribute("sizes")).toBe("(min-width: 672px) 640px, 100vw");
    expect(img.hasAttribute("data-photo")).toBe(true);
    const description = screen.getByText(/Pão brioche/);
    expect(description.textContent).toBe("Pão brioche e dois hambúrgueres.\nFeito na hora.");
    expect(description.className).toContain("whitespace-pre-line");
    expect(description.className).not.toContain("line-clamp");
  });

  it("sem foto e sem descrição não deixa espaço nem parágrafo vazio", () => {
    render(<DishOptions product={burger} onAdd={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByTestId("dish-description")).toBeNull();
  });

  it("produto sem opções: só a quantidade e Adicionar ao pedido", () => {
    const onAdd = vi.fn();
    render(
      <DishOptions product={{ ...withPhoto, addons: [], removables: [] }} onAdd={onAdd} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole("heading", { name: "Adicionar" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Tirar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao pedido" }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ productId: "b", quantity: 1 }));
  });
});

describe("observação para a cozinha, só para a equipe (spec 015, FR-018)", () => {
  it("o cliente não tem campo de texto", () => {
    render(<DishOptions product={burger} onAdd={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Precisa de outra mudança? Chame um garçom.")).toBeTruthy();
  });

  it("a equipe escreve até 140 letras, vê o contador e a observação vai na linha", () => {
    const onAdd = vi.fn();
    render(<DishOptions product={burger} onAdd={onAdd} onClose={vi.fn()} staff />);
    expect(screen.queryByText("Precisa de outra mudança? Chame um garçom.")).toBeNull();
    const note = screen.getByLabelText("Observação para a cozinha") as HTMLTextAreaElement;
    expect(note.maxLength).toBe(140);
    expect(screen.getByText("0/140")).toBeTruthy();
    fireEvent.change(note, { target: { value: "mal passado" } });
    expect(screen.getByText("11/140")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao pedido" }));
    expect(onAdd.mock.calls[0]![0]).toMatchObject({ productId: "b", kitchenNote: "mal passado" });
  });

  it("observação só com espaços não vai", () => {
    const onAdd = vi.fn();
    render(<DishOptions product={burger} onAdd={onAdd} onClose={vi.fn()} staff />);
    fireEvent.change(screen.getByLabelText("Observação para a cozinha"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao pedido" }));
    expect(onAdd.mock.calls[0]![0].kitchenNote).toBeNull();
  });
});
