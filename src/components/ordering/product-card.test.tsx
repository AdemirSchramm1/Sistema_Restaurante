// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MenuProduct } from "@/application/ordering/menu";
import { ProductCard } from "./product-card";

afterEach(cleanup);

/** Cartão do produto no cardápio do cliente (spec 013, US6.3 a US6.5). */
const burger: MenuProduct = {
  id: "b",
  name: "X-Burger duplo com bacon crocante, cheddar, cebola caramelizada e molho",
  price: "42.00",
  description: "Pão brioche e dois hambúrgueres.\nFeito na hora.",
  photo: { base: "/fotos/menu/abc", widths: [300, 600] },
  addons: [],
  removables: [],
};
const setup = (over: Partial<MenuProduct> = {}, eager = false) => {
  const onAdd = vi.fn();
  const onOpen = vi.fn();
  const view = render(
    <ul>
      <ProductCard product={{ ...burger, ...over }} eager={eager} onAdd={onAdd} onOpen={onOpen} />
    </ul>,
  );
  return { onAdd, onOpen, view };
};

describe("cartão do produto", () => {
  it("mostra a foto, o nome inteiro, a descrição com as quebras e o preço em destaque", () => {
    setup();
    const card = screen.getByRole("listitem");
    expect(card.className).toContain("bg-card");
    expect(screen.getByRole("img", { name: burger.name }).getAttribute("loading")).toBe("lazy");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(burger.name);
    const description = screen.getByText(/Pão brioche/);
    expect(description.textContent).toBe("Pão brioche e dois hambúrgueres.\nFeito na hora.");
    expect(description.className).toContain("whitespace-pre-line");
    // No cartão a descrição fica em até 3 linhas; inteira, só na tela do prato.
    expect(description.className).toContain("line-clamp-3");
    expect(description.hasAttribute("data-clamp")).toBe(true);
    const price = screen.getByText("R$ 42,00");
    expect(price.className).toContain("text-primary");
    expect(price.className).toContain("font-semibold");
  });

  it("a primeira foto da tela vem sem espera", () => {
    setup({}, true);
    expect(screen.getByRole("img").getAttribute("loading")).toBe("eager");
  });

  it("botão Adicionar com o nome do produto e 44 px de toque", () => {
    const { onAdd, onOpen } = setup({ name: "Suco" });
    const add = screen.getByRole("button", { name: "Adicionar Suco" });
    expect(add.textContent).toBe("Adicionar");
    expect(add.className).toContain("min-h-11");
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("tocar no nome ou na foto abre a tela do prato", () => {
    const { onAdd, onOpen } = setup({ name: "Suco" });
    const open = screen.getByRole("button", { name: "Ver Suco" });
    expect(open.className).toContain("min-h-11");
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
    // A foto e o nome ficam dentro do mesmo botão: um toque só, um nome só para o leitor de tela.
    expect(open.querySelector("img")).toBeTruthy();
    expect(open.querySelector("h3")).toBeTruthy();
  });

  it("sem descrição não deixa parágrafo vazio", () => {
    setup({ description: null });
    expect(screen.getByRole("listitem").querySelectorAll("p")).toHaveLength(0);
  });

  it("sem foto não deixa espaço reservado", () => {
    setup({ photo: null });
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("listitem").querySelector("[class*='aspect-']")).toBeNull();
  });
});
