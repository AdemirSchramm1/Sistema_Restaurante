// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

describe("preço de venda: salvar (spec 018)", () => {
  const submit = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar preço" }));
    });
  };

  it("recusa do servidor marca o campo e diz o motivo", async () => {
    render(
      <SalePrice
        {...base}
        action={async () => ({
          ok: false,
          error: { code: "INVALID_AMOUNT", message: "Preço inválido." },
          at: 1,
        })}
      />,
    );
    await submit();
    expect(await screen.findByText("Preço inválido.")).toBeTruthy();
    expect(screen.getByLabelText("Vendo por (R$)").getAttribute("aria-invalid")).toBe("true");
  });

  it("salvo diz que salvou", async () => {
    render(<SalePrice {...base} action={async () => ({ ok: true, data: null, at: 1 })} />);
    await submit();
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText("Preço salvo.")).toBeTruthy();
  });

  it("quem não pode editar e não há preço lê 'Sem preço de venda.'", () => {
    render(<SalePrice {...base} canEdit={false} salePrice={null} />);
    expect(screen.getByText("Sem preço de venda.")).toBeTruthy();
  });
});
