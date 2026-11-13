// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PreviewFrame } from "./preview-frame";

afterEach(cleanup);

/** "Ver como o cliente" (spec 013, US5). */
const frame = () => screen.getByTitle("Cardápio como o cliente vê") as HTMLIFrameElement;
const pressed = () =>
  screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") === "true")
    .map((b) => b.textContent);

describe("moldura da pré-visualização", () => {
  it("começa em Celular, com a moldura de 390 px apontando para o cardápio do cliente", () => {
    render(<PreviewFrame src="/pedidos/cardapio/ver/cliente" />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
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

  it("os botões formam um grupo com nome e há um link para abrir em tela cheia", () => {
    render(<PreviewFrame src="/pedidos/cardapio/ver/cliente" />);
    expect(screen.getByRole("group", { name: "Tamanho da tela" })).toBeTruthy();
    const link = screen.getByRole("link", { name: "Abrir em tela cheia" });
    expect(link.getAttribute("href")).toBe("/pedidos/cardapio/ver/cliente");
  });
});
