// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PaymentPanel } from "./payment-panel";

afterEach(cleanup);

const amount = () => (screen.getByLabelText("Valor (R$)") as HTMLInputElement).value;
const pick = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("receber com divisão (spec 011, US2 e US3)", () => {
  it("o valor começa com o que falta; cada parte escolhida preenche o pagamento, mesmo repetida", () => {
    render(<PaymentPanel tabId="t1" remaining="100.00" action={async () => null} cashSessionOpen />);
    expect(amount()).toBe("100,00");
    fireEvent.change(screen.getByLabelText("Dividir por quantas pessoas?"), { target: { value: "3" } });
    pick("Pagar parte 2 de 3");
    expect(amount()).toBe("33,33");
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "10,00" } });
    pick("Pagar parte 2 de 3");
    expect(amount()).toBe("33,33");
    pick("Pagar parte 1 de 3");
    expect(amount()).toBe("33,34");
  });
});

describe("receber exige o caixa aberto (spec 014, US1-1)", () => {
  it("com o caixa fechado, Lançar pagamento fica desligado com o motivo e o caminho para abrir", () => {
    render(<PaymentPanel tabId="t1" remaining="100.00" action={async () => null} cashSessionOpen={false} />);
    const submit = screen.getByRole("button", { name: "Lançar pagamento" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const reason = screen.getByText("Abra o caixa antes de receber.");
    expect(submit.getAttribute("aria-describedby")).toBe(reason.closest("[id]")?.id);
    expect(screen.getByRole("link", { name: "Ir para o Caixa" }).getAttribute("href")).toBe("/caixa");
  });

  it("com o caixa aberto, como antes: o botão funciona e não há aviso", () => {
    render(<PaymentPanel tabId="t1" remaining="100.00" action={async () => null} cashSessionOpen />);
    expect((screen.getByRole("button", { name: "Lançar pagamento" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText("Abra o caixa antes de receber.")).toBeNull();
  });
});
