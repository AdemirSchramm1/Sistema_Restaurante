// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SalePrice, type SalePriceProps } from "./sale-price";

afterEach(cleanup);

const base: SalePriceProps = {
  id: "x",
  version: 3,
  salePrice: "28,00",
  costText: "R$ 8,50",
  shareText: "30,4%",
  bandLabel: "dentro da faixa",
  marginText: "R$ 19,50",
  marginNegative: false,
  canEdit: true,
  action: async () => null,
};

describe("quadro do preço de venda (spec 008, US1)", () => {
  it("mostra o campo com o preço salvo e o resultado em frases", () => {
    render(<SalePrice {...base} />);
    expect((screen.getByLabelText("Vendo por (R$)") as HTMLInputElement).value).toBe("28,00");
    expect(screen.getByRole("button", { name: "Salvar preço" })).toBeTruthy();
    expect(screen.getByText(/30,4% do preço vai em ingredientes/).textContent).toContain("dentro da faixa");
    expect(screen.getByText(/Sobra R\$ 19,50 por venda/)).toBeTruthy();
  });

  it("prejuízo aparece como prejuízo", () => {
    render(<SalePrice {...base} marginText="R$ 0,50" marginNegative />);
    expect(screen.getByText(/Prejuízo de R\$ 0,50 por venda/)).toBeTruthy();
  });

  it("sem preço explica para que serve", () => {
    render(<SalePrice {...base} salePrice={null} shareText={null} bandLabel={null} marginText={null} />);
    expect((screen.getByLabelText("Vendo por (R$)") as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/Informe o preço para ver quanto dele vai em ingredientes/)).toBeTruthy();
  });

  it("sem custo avisa que o custo vem com as compras", () => {
    render(<SalePrice {...base} costText={null} shareText={null} bandLabel={null} marginText={null} />);
    expect(screen.getByText(/O custo aparece depois da primeira compra/)).toBeTruthy();
  });

  it("quem não pode editar só vê o preço", () => {
    render(<SalePrice {...base} canEdit={false} />);
    expect(screen.queryByRole("button", { name: "Salvar preço" })).toBeNull();
    expect(screen.getByText("Vendo por R$ 28,00")).toBeTruthy();
  });
});
