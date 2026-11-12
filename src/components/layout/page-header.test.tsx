// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "./page-header";

afterEach(cleanup);

describe("cabeçalho da tela (spec 012, US3)", () => {
  it("o título é o h1 da tela, na fonte de títulos", () => {
    render(<PageHeader title="Itens" />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Itens" });
    expect(h1.className).toContain("font-display");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("mostra a descrição e as ações", () => {
    render(
      <PageHeader
        title="Itens"
        description="Tudo o que o restaurante compra e guarda."
        actions={<button type="button">Novo item</button>}
      />,
    );
    expect(screen.getByText("Tudo o que o restaurante compra e guarda.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Novo item" })).toBeTruthy();
  });

  it("o link de voltar vem antes do título, com o texto dado", () => {
    render(
      <PageHeader title="Pedido 3 · Mesa 2" back={{ href: "/pedidos", label: "Voltar para os pedidos" }} />,
    );
    const back = screen.getByRole("link", { name: "Voltar para os pedidos" });
    expect(back.getAttribute("href")).toBe("/pedidos");
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(back.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("etiquetas ficam ao lado do título, fora do h1", () => {
    render(<PageHeader title="Arroz" badges={<Badge>inativo</Badge>} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Arroz");
    expect(screen.getByText("inativo")).toBeTruthy();
  });
});
