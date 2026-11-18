// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MenuProduct } from "@/application/ordering/menu";
import { ProductCard } from "./product-card";

afterEach(cleanup);

/**
 * Cartão do produto no cardápio do cliente (spec 013, US6.3 a US6.5), compacto desde a 016 (US2):
 * nome em até 2 linhas, descrição em até 2 e o "+" no lugar do botão "Adicionar".
 */
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
      <ProductCard product={{ ...burger, ...over }} eager={eager} onQuickAdd={onAdd} onOpen={onOpen} />
    </ul>,
  );
  return { onAdd, onOpen, view };
};

describe("cartão do produto", () => {
  it("mostra a foto, o nome (inteiro no title), a descrição com as quebras e o preço em destaque", () => {
    setup();
    const card = screen.getByRole("listitem");
    expect(card.className).toContain("bg-card");
    expect(screen.getByRole("img", { name: burger.name }).getAttribute("loading")).toBe("lazy");
    const name = screen.getByRole("heading", { level: 3 });
    expect(name.textContent).toBe(burger.name);
    // Compacto (spec 016): o nome em até 2 linhas, inteiro no title e no nome acessível.
    expect(name.className).toContain("line-clamp-2");
    expect(name.getAttribute("title")).toBe(burger.name);
    const description = screen.getByText(/Pão brioche/);
    expect(description.textContent).toBe("Pão brioche e dois hambúrgueres.\nFeito na hora.");
    expect(description.className).toContain("whitespace-pre-line");
    // No cartão a descrição fica em até 2 linhas (era 3 na 013); inteira, só na tela do prato.
    expect(description.className).toContain("line-clamp-2");
    expect(description.hasAttribute("data-clamp")).toBe(true);
    const price = screen.getAllByText("R$ 42,00")[0]!;
    expect(price.className).toContain("text-primary");
    expect(price.className).toContain("font-semibold");
  });

  it("a primeira foto da tela vem sem espera", () => {
    setup({}, true);
    expect(screen.getByRole("img").getAttribute("loading")).toBe("eager");
  });

  it('"+" com o nome do produto e 44 × 44 px de toque (era "Adicionar" na 013)', () => {
    const { onAdd, onOpen } = setup({ name: "Suco" });
    const add = screen.getByRole("button", { name: "Pôr Suco no carrinho" });
    expect(add.textContent).toBe("+");
    expect(add.className).toContain("size-11");
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

describe("linha no celular e cartão a partir de 600 px (spec 016, US2-1)", () => {
  it("linha: foto de 112 px à esquerda; a partir de 600 px, foto em cima e o + no canto", () => {
    setup();
    const card = screen.getByRole("listitem");
    expect(card.className).toContain("tab:flex-col");
    const img = screen.getByRole("img");
    expect(img.className).toContain("w-28");
    expect(img.className).toContain("tab:w-full");
    expect(img.getAttribute("sizes")).toMatch(/112px$/);
    expect(img.getAttribute("srcset")).toContain("300w");
    const plus = screen.getByRole("button", { name: `Pôr ${burger.name} no carrinho` });
    // O "+" fica fora do botão que abre o prato: os dois toques não se cobrem.
    expect(screen.getByRole("button", { name: `Ver ${burger.name}` }).contains(plus)).toBe(false);
  });

  it("o preço fica no texto na linha e desce para o pé, ao lado do +, no cartão", () => {
    setup();
    const [inRow, inCard] = screen.getAllByText("R$ 42,00");
    expect(inRow!.className).toContain("tab:hidden");
    expect(inCard!.className).toMatch(/^hidden .*tab:inline/);
    expect(inCard!.getAttribute("aria-hidden")).toBe("true");
    expect(inCard!.parentElement!.contains(screen.getByRole("button", { name: /^Pôr / }))).toBe(true);
  });

  it("o nome cortado em 2 linhas é corte de propósito (data-clamp)", () => {
    setup();
    expect(screen.getByRole("heading", { level: 3 }).hasAttribute("data-clamp")).toBe(true);
  });
});
