// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { SalesReportPage, type SalesReportView } from "./sales-report";

afterEach(cleanup);

const report: SalesReportView = {
  from: "2026-10-31",
  to: "2026-10-31",
  timezone: "America/Sao_Paulo",
  byMethod: [
    { method: "CASH", amount: "78.00" },
    { method: "PIX", amount: "34.00" },
    { method: "DEBIT_CARD", amount: "0.00" },
    { method: "CREDIT_CARD", amount: "0.00" },
    { method: "OTHER", amount: "0.00" },
  ],
  removedFromOtherSessions: [],
  received: "112.00",
  serviceCharge: "3.40",
  products: [
    { recipeId: "r1", name: "X-Burger", quantity: 3, amount: "94.00", share: "83.9" },
    { recipeId: "r2", name: "Suco", quantity: 2, amount: "18.00", share: "16.1" },
  ],
  productsTotal: "112.00",
  addons: [{ addonId: "a1", name: "Fatia de queijo", times: 2, amount: "4.00" }],
  sessions: [
    {
      id: "s1",
      businessDay: "2026-10-31",
      status: "CLOSED",
      openedAt: "2026-10-31T14:02:00.000Z",
      openedByName: "Ana",
      closedAt: "2026-11-01T02:10:00.000Z",
      closedByName: "Ana",
      received: "112.00",
      difference: "-2.00",
      result: "SHORT",
    },
  ],
  differenceTotal: "-2.00",
  pendingOrders: 0,
};
const rowsOf = (name: string) =>
  within(screen.getByRole("table", { name }))
    .getAllByRole("row")
    .map((r) => [...r.children].map((c) => c.textContent).join(" | "));

describe("Vendas (spec 014, US6)", () => {
  it("filtro de período com as datas escolhidas e a planilha do mesmo período", () => {
    render(<SalesReportPage report={report} />);
    expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("2026-10-31");
    expect((screen.getByLabelText("Até") as HTMLInputElement).value).toBe("2026-10-31");
    expect(screen.getByRole("link", { name: "Baixar planilha" }).getAttribute("href")).toBe(
      "/vendas/planilha?de=2026-10-31&ate=2026-10-31",
    );
  });

  it("formas de pagamento com o total recebido e a taxa (US6-2)", () => {
    render(<SalesReportPage report={report} />);
    expect(rowsOf("Recebido por forma de pagamento")).toEqual([
      "Forma | Valor",
      "Dinheiro | R$ 78,00",
      "Pix | R$ 34,00",
      "Cartão de débito | R$ 0,00",
      "Cartão de crédito | R$ 0,00",
      "Outro | R$ 0,00",
      "Total recebido | R$ 112,00",
      "Taxa de serviço das contas fechadas | R$ 3,40",
    ]);
    expect(screen.queryByText(/tirados de turnos anteriores/)).toBeNull();
  });

  it("produtos com a parte em %, adicionais à parte e o texto que explica a diferença (US6-3 e US6-4)", () => {
    render(<SalesReportPage report={report} />);
    expect(rowsOf("Vendas por produto")).toEqual([
      "Produto | Quantidade | Valor | Parte",
      "X-Burger | 3 | R$ 94,00 | 83,9%",
      "Suco | 2 | R$ 18,00 | 16,1%",
      "Total dos produtos |  | R$ 112,00 | ",
    ]);
    expect(rowsOf("Adicionais vendidos")).toEqual([
      "Adicional | Vezes | Valor",
      "Fatia de queijo | 2 | R$ 4,00",
    ]);
    expect(
      screen.getByText(
        "Recebido conta o dinheiro que entrou nos turnos; vendas contam os pedidos feitos no período. Uma conta aberta à noite e paga depois da meia-noite aparece em dias diferentes.",
      ),
    ).toBeTruthy();
    const qty = screen.getByRole("cell", { name: "3" });
    expect(qty.className).toContain("tabular-nums");
  });

  it("turnos do período com link e a soma das diferenças (US6-5)", () => {
    render(<SalesReportPage report={report} />);
    expect(screen.getByRole("link", { name: "31/10/2026" }).getAttribute("href")).toBe("/caixa/turnos/s1");
    expect(screen.getByText("Soma das diferenças: Falta R$ 2,00")).toBeTruthy();
  });

  it("pedidos pendentes avisam; pagamentos tirados de turnos anteriores aparecem quando existem", () => {
    render(
      <SalesReportPage
        report={{
          ...report,
          pendingOrders: 2,
          removedFromOtherSessions: [{ method: "PIX", amount: "10.00" }],
        }}
      />,
    );
    expect(
      screen.getByText("2 pedidos do período ainda não foram entregues. Eles já contam nas vendas."),
    ).toBeTruthy();
    expect(screen.getByText("Pix tirados de turnos anteriores: R$ 10,00")).toBeTruthy();
    cleanup();
    render(<SalesReportPage report={{ ...report, pendingOrders: 1 }} />);
    expect(
      screen.getByText("1 pedido do período ainda não foi entregue. Ele já conta nas vendas."),
    ).toBeTruthy();
  });

  it("período sem vendas explica, sem tabelas de produtos", () => {
    render(
      <SalesReportPage
        report={{
          ...report,
          products: [],
          addons: [],
          sessions: [],
          productsTotal: "0.00",
          differenceTotal: "0.00",
        }}
      />,
    );
    expect(screen.getByText("Nenhuma venda neste período")).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Vendas por produto" })).toBeNull();
    expect(screen.queryByRole("table", { name: "Adicionais vendidos" })).toBeNull();
    expect(screen.getByText("Nenhum turno neste período")).toBeTruthy();
    expect(screen.queryByText(/Soma das diferenças/)).toBeNull();
  });

  it("produtos sem adicionais não mostram a tabela de adicionais", () => {
    render(<SalesReportPage report={{ ...report, addons: [] }} />);
    expect(screen.queryByRole("table", { name: "Adicionais vendidos" })).toBeNull();
  });

  it("soma das diferenças zerada diz Bateu", () => {
    render(<SalesReportPage report={{ ...report, differenceTotal: "0.00" }} />);
    expect(screen.getByText("Soma das diferenças: Bateu")).toBeTruthy();
  });
});
