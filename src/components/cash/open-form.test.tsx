// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { UUID, actionSpy, clickButton, refusal, typeIn, valueOf } from "@/components/forms/testing";
import { OpenForm } from "./open-form";

afterEach(cleanup);

const NOTE = "Por que o troco é outro?";
const HINT = "Ficaram R$ 150,00 na gaveta no último fechamento. Por que o troco é outro?";

describe("abrir o caixa (spec 014, US1-2 e US1-3)", () => {
  it("o campo vem com o que ficou na gaveta; no primeiro turno, com R$ 0,00", () => {
    render(<OpenForm previousKept="150.00" action={actionSpy().action} />);
    expect(valueOf("Troco inicial (R$)")).toBe("150,00");
    expect(screen.queryByLabelText(NOTE)).toBeNull();
    cleanup();
    render(<OpenForm previousKept={null} action={actionSpy().action} />);
    expect(valueOf("Troco inicial (R$)")).toBe("0,00");
    typeIn("Troco inicial (R$)", "80,00");
    expect(screen.queryByLabelText(NOTE)).toBeNull();
  });

  it("troco diferente do que ficou pede a observação; voltar ao valor tira o pedido", () => {
    render(<OpenForm previousKept="150.00" action={actionSpy().action} />);
    typeIn("Troco inicial (R$)", "120,00");
    expect(screen.getByText(HINT)).toBeTruthy();
    expect((screen.getByLabelText(NOTE) as HTMLInputElement).required).toBe(true);
    typeIn("Troco inicial (R$)", "150");
    expect(screen.queryByLabelText(NOTE)).toBeNull();
    // Enquanto o valor não é um número, a tela não pede explicação.
    typeIn("Troco inicial (R$)", "cento e vinte");
    expect(screen.queryByLabelText(NOTE)).toBeNull();
  });

  it("envia o troco, a observação e o id da abertura; toque duplo manda o mesmo id (FR-012)", async () => {
    const s = actionSpy(refusal("CASH_SESSION_ALREADY_OPEN", "O caixa já foi aberto por Bruno às 11:01."));
    render(<OpenForm previousKept="150.00" action={s.action} />);
    typeIn("Troco inicial (R$)", "120,00");
    typeIn(NOTE, "Paguei o gás com o troco");
    await clickButton("Abrir caixa", 2);
    expect(s.calls[0]).toEqual({
      openingFloat: "120,00",
      note: "Paguei o gás com o troco",
      clientRequestId: expect.stringMatching(UUID),
    });
    expect(new Set(s.calls.map((c) => c.clientRequestId)).size).toBe(1);
  });

  it("erro do servidor aparece no aviso e o que foi digitado continua", async () => {
    const s = actionSpy(refusal("CASH_SESSION_ALREADY_OPEN", "O caixa já foi aberto por Bruno às 11:01."));
    render(<OpenForm previousKept={null} action={s.action} />);
    typeIn("Troco inicial (R$)", "80,00");
    await clickButton("Abrir caixa");
    expect(screen.getByRole("alert").textContent).toBe("O caixa já foi aberto por Bruno às 11:01.");
    expect(valueOf("Troco inicial (R$)")).toBe("80,00");
  });
});
