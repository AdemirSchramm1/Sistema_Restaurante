// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { SessionReport } from "./session-report";
import type { SessionReportView } from "./view";

afterEach(cleanup);

/** O turno do teste independente da US5. */
const closed: SessionReportView = {
  id: "s1",
  status: "CLOSED",
  businessDay: "2026-11-17",
  restaurantName: "Cantina da Praça",
  timezone: "America/Sao_Paulo",
  openedAt: "2026-11-17T14:02:00.000Z",
  openedByName: "Ana",
  openingFloat: "150.00",
  previousKept: null,
  openingNote: null,
  closedAt: "2026-11-18T02:10:00.000Z",
  closedByName: "Bruno",
  receivedByMethod: [
    { method: "CASH", amount: "77.00" },
    { method: "PIX", amount: "40.00" },
    { method: "DEBIT_CARD", amount: "0.00" },
    { method: "CREDIT_CARD", amount: "0.00" },
    { method: "OTHER", amount: "0.00" },
  ],
  received: "117.00",
  removedFromOtherSessions: [],
  serviceCharge: "10.70",
  entries: [
    {
      id: "e1",
      kind: "WITHDRAWAL",
      amount: "150.00",
      reason: "SAFE",
      note: null,
      at: "2026-11-17T15:00:00.000Z",
      byName: "Ana",
      removedAt: null,
      removedByName: null,
    },
    {
      id: "e2",
      kind: "SUPPLY",
      amount: "50.00",
      reason: null,
      note: "Troco do cofre",
      at: "2026-11-17T16:00:00.000Z",
      byName: "Ana",
      removedAt: null,
      removedByName: null,
    },
  ],
  counts: ["120.00", "125.00"],
  steps: [
    { key: "OPENING_FLOAT", sign: null, amount: "150.00" },
    { key: "CASH_RECEIVED", sign: "+", amount: "77.00" },
    { key: "CASH_REMOVED", sign: "-", amount: "0.00" },
    { key: "SUPPLIES", sign: "+", amount: "50.00" },
    { key: "WITHDRAWALS", sign: "-", amount: "150.00" },
    { key: "EXPECTED", sign: "=", amount: "127.00" },
  ],
  expected: "127.00",
  counted: "125.00",
  difference: "-2.00",
  result: "SHORT",
  kept: "100.00",
  takenToSafe: "25.00",
  closeNote: "Troco errado na mesa 4",
};
const open: SessionReportView = {
  ...closed,
  status: "OPEN",
  closedAt: null,
  closedByName: null,
  counts: [],
  counted: null,
  difference: null,
  result: null,
  kept: null,
  takenToSafe: null,
  closeNote: null,
};
const headings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
const rowsOf = (name: string) =>
  within(screen.getByRole("table", { name }))
    .getAllByRole("row")
    .map((r) => [...r.children].map((c) => c.textContent).join(" | "));

describe("relatório do turno (spec 014, US5)", () => {
  it("as seções na ordem da US5-1", () => {
    render(<SessionReport report={closed} />);
    expect(headings()).toEqual([
      "Abertura e fechamento",
      "Recebido por forma de pagamento",
      "Sangrias e reforços",
      "Conta do dinheiro",
    ]);
    expect(screen.getByText("Aberto em 17/11/2026 às 11:02 por Ana")).toBeTruthy();
    expect(screen.getByText("Fechado em 17/11/2026 às 23:10 por Bruno")).toBeTruthy();
    expect(screen.getByText("Troco inicial: R$ 150,00")).toBeTruthy();
    expect(screen.queryByText("Não é documento fiscal")).toBeNull();
  });

  it("recebido por forma, total e taxa de serviço das contas fechadas no turno", () => {
    render(<SessionReport report={closed} />);
    expect(rowsOf("Recebido por forma de pagamento")).toEqual([
      "Dinheiro | R$ 77,00",
      "Pix | R$ 40,00",
      "Cartão de débito | R$ 0,00",
      "Cartão de crédito | R$ 0,00",
      "Outro | R$ 0,00",
      "Total recebido | R$ 117,00",
      "Taxa de serviço das contas fechadas no turno | R$ 10,70",
    ]);
  });

  it("a conta do dinheiro passo a passo, com os 6 valores, o contado e a diferença (US5-2)", () => {
    render(<SessionReport report={closed} />);
    expect(rowsOf("Conta do dinheiro")).toEqual([
      "Troco inicial | R$ 150,00",
      "+ Recebido em dinheiro | R$ 77,00",
      "− Pagamentos em dinheiro tirados de outro turno | R$ 0,00",
      "+ Reforços | R$ 50,00",
      "− Sangrias | R$ 150,00",
      "= Esperado na gaveta | R$ 127,00",
      "Contado | R$ 125,00",
      "Diferença | Falta R$ 2,00",
      "Fica na gaveta | R$ 100,00",
      "Retirada do fechamento | R$ 25,00",
    ]);
    expect(screen.getByText("1ª contagem R$ 120,00 · 2ª contagem R$ 125,00")).toBeTruthy();
    expect(screen.getByText("Observação do fechamento: Troco errado na mesa 4")).toBeTruthy();
  });

  it("sangrias com motivo e reforços com a observação, sem botões", () => {
    render(<SessionReport report={closed} />);
    expect(screen.getByText("Sangria · Cofre")).toBeTruthy();
    expect(screen.getByText("Troco do cofre")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("Pagamento tirado de outro turno só aparece quando existe (US2-3)", () => {
    render(<SessionReport report={closed} />);
    expect(screen.queryByText(/tirados de outro turno \(/)).toBeNull();
    expect(screen.queryByRole("table", { name: "Pagamentos tirados de outro turno" })).toBeNull();
    cleanup();
    render(
      <SessionReport report={{ ...closed, removedFromOtherSessions: [{ method: "CASH", amount: "30.00" }] }} />,
    );
    expect(rowsOf("Pagamentos tirados de outro turno")).toEqual(["Dinheiro | R$ 30,00"]);
  });

  it("troco diferente do que ficou na gaveta mostra o valor anterior e a observação da abertura (US1-3)", () => {
    render(
      <SessionReport report={{ ...closed, previousKept: "180.00", openingNote: "Paguei o gás com o troco" }} />,
    );
    expect(screen.getByText("Ficaram R$ 180,00 na gaveta no fechamento anterior.")).toBeTruthy();
    expect(screen.getByText("Observação da abertura: Paguei o gás com o troco")).toBeTruthy();
    cleanup();
    render(<SessionReport report={{ ...closed, previousKept: "150.00" }} />);
    expect(screen.queryByText(/no fechamento anterior/)).toBeNull();
  });

  it("esperado negativo em destaque (caso-limite)", () => {
    const steps = closed.steps!.map((s) => (s.key === "EXPECTED" ? { ...s, amount: "-23.00" } : s));
    render(<SessionReport report={{ ...closed, steps, expected: "-23.00" }} />);
    const value = screen.getByText("R$ -23,00");
    expect(value.className).toContain("text-destructive");
    expect(screen.getByText("R$ 77,00", { selector: "td" }).className).not.toContain("text-destructive");
  });

  it("turno aberto, para o gerente: parcial, sem contado e sem diferença (US5-3)", () => {
    render(<SessionReport report={open} />);
    expect(screen.getByText("Caixa aberto: relatório parcial, sem o contado e a diferença.")).toBeTruthy();
    expect(rowsOf("Conta do dinheiro").at(-1)).toBe("= Esperado na gaveta | R$ 127,00");
    expect(screen.queryByText(/contagem/)).toBeNull();
    expect(screen.queryByText(/Observação do fechamento/)).toBeNull();
  });

  it("turno aberto, para o caixa: o esperado não aparece; ele vê o recebido por forma (US5-3)", () => {
    const { container } = render(<SessionReport report={{ ...open, steps: null, expected: null }} />);
    expect(container.innerHTML).not.toContain("127,00");
    expect(screen.queryByRole("table", { name: "Conta do dinheiro" })).toBeNull();
    expect(screen.getByText("O dinheiro esperado aparece depois da contagem, em Fechar caixa.")).toBeTruthy();
    expect(rowsOf("Recebido por forma de pagamento")[0]).toBe("Dinheiro | R$ 77,00");
  });

  it("sem quem abriu ou fechou, a frase fica sem o nome", () => {
    render(<SessionReport report={{ ...closed, openedByName: null, closedByName: null, entries: [] }} />);
    expect(screen.getByText("Aberto em 17/11/2026 às 11:02")).toBeTruthy();
    expect(screen.getByText("Fechado em 17/11/2026 às 23:10")).toBeTruthy();
    expect(screen.getByText("Nenhuma sangria ou reforço neste turno.")).toBeTruthy();
  });

  it("versão para impressão: folha simples com o restaurante e Não é documento fiscal (US5-4)", () => {
    render(<SessionReport report={closed} print />);
    const sheet = screen.getByRole("article", { name: "Relatório do turno de 17/11/2026" });
    expect(sheet.className).toContain("tab-print");
    expect(screen.getByRole("heading", { level: 1, name: "Cantina da Praça" })).toBeTruthy();
    expect(screen.getByText("Não é documento fiscal")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
