// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ProductCostTable } from "./product-cost-table";
import {
  evaluateProductCost,
  rankProductCosts,
  summarizeProductCosts,
  type ProductCostInput,
} from "@/domain/inventory/product-cost";
import { d } from "@/domain/shared/decimal";

afterEach(cleanup);

const input = (over: Partial<ProductCostInput> = {}): ProductCostInput => ({
  id: "x",
  name: "X-Burger",
  salePrice: d("28.00"),
  cost: d("8.50"),
  lines: [
    { name: "Pão de hambúrguer", cost: d(1) },
    { name: "Carne moída", cost: d(6) },
    { name: "Queijo prato", cost: d("1.5") },
  ],
  missingCostNames: [],
  ...over,
});
const panel = (...inputs: ProductCostInput[]) => {
  const rows = rankProductCosts(inputs.map(evaluateProductCost));
  return { rows, summary: summarizeProductCosts(rows) };
};
const row = (id: string) =>
  screen.getByRole("table", { name: "Custo dos produtos" }).querySelector(`tr[data-product="${id}"]`)!;

describe("painel de custo dos produtos (spec 008, US2)", () => {
  it("mostra custo, preço, custo no preço com faixa, sobra e o que mais pesa", () => {
    render(<ProductCostTable panel={panel(input())} />);
    const r = row("x");
    expect(
      within(r as HTMLElement)
        .getByRole("link", { name: "X-Burger" })
        .getAttribute("href"),
    ).toBe("/estoque/produtos/x");
    expect(r.textContent).toContain("R$ 8,50");
    expect(r.textContent).toContain("R$ 28,00");
    expect(r.textContent).toContain("30,4%");
    expect(r.textContent).toContain("dentro da faixa");
    expect(r.textContent).toContain("R$ 19,50");
    expect(r.textContent).toContain("Carne moída");
    expect(r.textContent).toContain("71% do custo");
  });

  it("a barra mostra a % do preço e tem a marca dos 35%", () => {
    render(<ProductCostTable panel={panel(input({ salePrice: d(20) }))} />);
    const r = row("x") as HTMLElement;
    expect(within(r).getByTestId("cost-bar").style.width).toBe("43%");
    expect(within(r).getByTestId("cost-bar-limit").style.left).toBe("35%");
    expect(r.textContent).toContain("42,5%");
    expect(r.textContent).toContain("alto");
  });

  it("vendido abaixo do custo mostra prejuízo", () => {
    render(<ProductCostTable panel={panel(input({ salePrice: d(8) }))} />);
    expect(row("x").textContent).toContain("Prejuízo de R$ 0,50");
  });

  it("sem preço oferece definir o preço; sem custo diz o que falta comprar", () => {
    render(
      <ProductCostTable
        panel={panel(
          input({ id: "sem-preco", name: "Batata", salePrice: null }),
          input({
            id: "sem-custo",
            name: "Salada",
            cost: null,
            lines: [{ name: "Alface", cost: null }],
            missingCostNames: ["Alface"],
          }),
        )}
      />,
    );
    const noPrice = row("sem-preco") as HTMLElement;
    expect(noPrice.textContent).toContain("Sem preço");
    expect(within(noPrice).getByRole("link", { name: "Definir preço" }).getAttribute("href")).toBe(
      "/estoque/produtos/sem-preco",
    );
    expect(within(noPrice).queryByTestId("cost-bar")).toBeNull();
    const noCost = row("sem-custo");
    expect(noCost.textContent).toContain("Sem custo ainda");
    expect(noCost.textContent).toContain("Falta comprar: Alface");
  });

  it("resumo em frases, com singular e plural", () => {
    render(
      <ProductCostTable
        panel={panel(
          input({ id: "a", name: "A", salePrice: d(20) }),
          input({ id: "b", name: "B", salePrice: d(10) }),
          input({ id: "c", name: "C", salePrice: d(23) }),
          input({ id: "d", name: "D", salePrice: null }),
        )}
      />,
    );
    const summary = screen.getByRole("list", { name: "Resumo" });
    expect(summary.textContent).toContain("2 produtos com custo alto");
    expect(summary.textContent).toContain("1 produto em atenção");
    expect(summary.textContent).toContain("1 produto sem preço");
    expect(summary.textContent).not.toContain("dentro da faixa");
    expect(summary.textContent).not.toContain("sem custo");
  });

  it("sem produtos vendidos convida a cadastrar", () => {
    render(<ProductCostTable panel={panel()} />);
    expect(screen.getByText("Nenhum produto vendido cadastrado.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Novo produto" }).getAttribute("href")).toBe(
      "/estoque/produtos/novo",
    );
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("painel de custo: produto de custo zero (spec 018)", () => {
  it("custo zero não aponta o que mais pesa", () => {
    render(<ProductCostTable panel={panel(input({ cost: d(0), lines: [{ name: "Água", cost: d(0) }] }))} />);
    expect(row("x").textContent).toContain("—");
  });
});
