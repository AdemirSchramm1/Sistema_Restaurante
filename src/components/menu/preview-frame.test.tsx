// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PreviewFrame } from "./preview-frame";

afterEach(cleanup);

/** "Ver como o cliente" (spec 013, US5). */
const frame = () => screen.getByTitle("Cardápio como o cliente vê") as HTMLIFrameElement;
const sizes = () => within(screen.getByRole("group", { name: "Tamanho da tela" }));
const pressed = () =>
  sizes()
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") === "true")
    .map((b) => b.textContent);

describe("moldura da pré-visualização", () => {
  it("começa em Celular, com a moldura de 390 px apontando para o cardápio do cliente", () => {
    render(<PreviewFrame src="/pedidos/cardapio/ver/cliente" />);
    expect(sizes().getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Celular",
      "Tablet em pé",
      "Tablet deitado",
    ]);
    expect(pressed()).toEqual(["Celular"]);
    expect(frame().tagName).toBe("IFRAME");
    expect(frame().getAttribute("src")).toBe("/pedidos/cardapio/ver/cliente");
    expect(frame().style.width).toBe("390px");
    expect(frame().style.height).toBe("844px");
    for (const b of screen.getAllByRole("button")) expect(b.className).toContain("min-h-11");
  });

  it("Tablet em pé e Tablet deitado mudam a moldura para 768 e 1024 px", () => {
    render(<PreviewFrame src="/x" />);
    fireEvent.click(screen.getByRole("button", { name: "Tablet em pé" }));
    expect(pressed()).toEqual(["Tablet em pé"]);
    expect([frame().style.width, frame().style.height]).toEqual(["768px", "1024px"]);
    fireEvent.click(screen.getByRole("button", { name: "Tablet deitado" }));
    expect(pressed()).toEqual(["Tablet deitado"]);
    expect([frame().style.width, frame().style.height]).toEqual(["1024px", "768px"]);
    fireEvent.click(screen.getByRole("button", { name: "Celular" }));
    expect(frame().style.width).toBe("390px");
  });

  it("a moldura maior que a tela rola dentro da sua caixa, sem alargar a página", () => {
    render(<PreviewFrame src="/x" />);
    expect(frame().parentElement!.className).toContain("overflow-x-auto");
    expect(frame().className).toContain("max-w-none");
  });

  it("a caixa que rola tem nome e recebe o foco, para rolar pelo teclado (axe)", () => {
    render(<PreviewFrame src="/x" />);
    const box = screen.getByRole("region", { name: "Moldura da pré-visualização" });
    expect(box).toBe(frame().parentElement);
    expect(box.tabIndex).toBe(0);
  });

  it("os botões formam um grupo com nome e há um link para abrir em tela cheia", () => {
    render(<PreviewFrame src="/pedidos/cardapio/ver/cliente" />);
    expect(screen.getByRole("group", { name: "Tamanho da tela" })).toBeTruthy();
    const link = screen.getByRole("link", { name: "Abrir em tela cheia" });
    expect(link.getAttribute("href")).toBe("/pedidos/cardapio/ver/cliente");
  });

  it("escolha Celular pelo QR code / Tablet da mesa (spec 016): o tablet abre deitado, com ?modo=tablet", () => {
    render(<PreviewFrame src="/pedidos/cardapio/ver/cliente" />);
    const modes = within(screen.getByRole("group", { name: "Como o cliente vê" }));
    expect(modes.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Celular pelo QR code",
      "Tablet da mesa",
    ]);
    expect(modes.getByRole("button", { name: "Celular pelo QR code" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(modes.getByRole("button", { name: "Tablet da mesa" }));
    expect(frame().getAttribute("src")).toBe("/pedidos/cardapio/ver/cliente?modo=tablet");
    expect(pressed()).toEqual(["Tablet deitado"]);
    expect(screen.getByRole("link", { name: "Abrir em tela cheia" }).getAttribute("href")).toBe(
      "/pedidos/cardapio/ver/cliente?modo=tablet",
    );
    fireEvent.click(modes.getByRole("button", { name: "Celular pelo QR code" }));
    expect(frame().getAttribute("src")).toBe("/pedidos/cardapio/ver/cliente");
    expect(pressed()).toEqual(["Celular"]);
  });
});
