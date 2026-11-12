// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";
import { CloseTabForm, PaymentForm, PaymentList } from "./payment-form";

afterEach(cleanup);

function spy(result: ActionState = { ok: true, data: null, at: 1 }) {
  const calls: Record<string, string>[] = [];
  const action = async (_prev: ActionState, form: FormData): Promise<ActionState> => {
    calls.push(Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])));
    return result;
  };
  return { calls, action };
}

const click = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const valueOf = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("lançar pagamento (spec 011, US2-1 a US2-3)", () => {
  it("cinco formas e o valor já vem com o que falta", () => {
    render(<PaymentForm tabId="t12" remaining="84.70" action={spy().action} />);
    for (const label of ["Dinheiro", "Pix", "Cartão de débito", "Cartão de crédito", "Outro"])
      expect(screen.getByRole("radio", { name: label })).toBeTruthy();
    expect(valueOf("Valor (R$)")).toBe("84,70");
    expect(screen.queryByLabelText("Recebido em dinheiro (R$)")).toBeNull();
  });

  it("dinheiro: o recebido acima do valor mostra o troco", () => {
    render(<PaymentForm tabId="t12" remaining="27.00" action={spy().action} />);
    fireEvent.click(screen.getByRole("radio", { name: "Dinheiro" }));
    type("Recebido em dinheiro (R$)", "50,00");
    expect(screen.getByText("Troco: R$ 23,00")).toBeTruthy();
    type("Recebido em dinheiro (R$)", "20,00");
    expect(screen.queryByText(/Troco/)).toBeNull();
  });

  it("envia a forma, o valor e o id do pagamento; dinheiro manda também o recebido", async () => {
    const s = spy();
    render(<PaymentForm tabId="t12" remaining="84.70" action={s.action} />);
    fireEvent.click(screen.getByRole("radio", { name: "Pix" }));
    await click("Lançar pagamento");
    expect(s.calls).toEqual([
      { tabId: "t12", clientRequestId: expect.stringMatching(UUID), method: "PIX", amount: "84,70" },
    ]);
    cleanup();
    const cash = spy();
    render(<PaymentForm tabId="t12" remaining="27.00" action={cash.action} />);
    fireEvent.click(screen.getByRole("radio", { name: "Dinheiro" }));
    type("Recebido em dinheiro (R$)", "50,00");
    await click("Lançar pagamento");
    expect(cash.calls[0]).toMatchObject({ method: "CASH", amount: "27,00", received: "50,00" });
  });

  it("recusa do servidor aparece em português, com o que foi digitado, e repetir usa o mesmo id", async () => {
    const s = spy({
      ok: false,
      error: {
        code: "PAYMENT_EXCEEDS_REMAINING",
        field: "amount",
        message: "O valor passa do que falta pagar (R$ 40,00).",
      },
      at: 1,
    });
    render(<PaymentForm tabId="t12" remaining="40.00" action={s.action} />);
    fireEvent.click(screen.getByRole("radio", { name: "Cartão de crédito" }));
    type("Valor (R$)", "45,00");
    await click("Lançar pagamento");
    expect(await screen.findByText("O valor passa do que falta pagar (R$ 40,00).")).toBeTruthy();
    expect(valueOf("Valor (R$)")).toBe("45,00");
    await click("Lançar pagamento");
    expect(s.calls[1]!.clientRequestId).toBe(s.calls[0]!.clientRequestId);
  });

  it("depois de lançar, o valor volta a ser o que falta e o próximo pagamento tem outro id", async () => {
    const s = spy();
    const { rerender } = render(<PaymentForm tabId="t12" remaining="84.70" action={s.action} />);
    fireEvent.click(screen.getByRole("radio", { name: "Pix" }));
    type("Valor (R$)", "50,00");
    await click("Lançar pagamento");
    rerender(<PaymentForm tabId="t12" remaining="34.70" action={s.action} />);
    expect(valueOf("Valor (R$)")).toBe("34,70");
    fireEvent.click(screen.getByRole("radio", { name: "Pix" }));
    await click("Lançar pagamento");
    expect(s.calls[1]!.clientRequestId).not.toBe(s.calls[0]!.clientRequestId);
  });

  it("valor pedido de fora (parte da divisão) preenche o campo", () => {
    const { rerender } = render(<PaymentForm tabId="t12" remaining="100.00" action={spy().action} />);
    rerender(
      <PaymentForm tabId="t12" remaining="100.00" action={spy().action} fill={{ amount: "33.34", at: 1 }} />,
    );
    expect(valueOf("Valor (R$)")).toBe("33,34");
  });
});

describe("fechar a conta (spec 011, US2-6)", () => {
  it("desabilitado com o motivo enquanto falta pagar ou há pedido não entregue", () => {
    render(
      <CloseTabForm
        tab={{
          id: "t12",
          version: 5,
          remaining: "34.70",
          blockers: ["REMAINING_NOT_ZERO", "PENDING_ORDERS"],
        }}
        action={spy().action}
      />,
    );
    expect((screen.getByRole("button", { name: "Fechar conta" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Ainda falta pagar R$ 34,70.")).toBeTruthy();
    expect(screen.getByText("A mesa tem pedidos que ainda não foram entregues.")).toBeTruthy();
  });

  it("pago a mais também segura o fechamento", () => {
    render(
      <CloseTabForm
        tab={{ id: "t12", version: 5, remaining: "-1.30", blockers: ["REMAINING_NOT_ZERO"] }}
        action={spy().action}
      />,
    );
    expect(screen.getByText("Foi pago R$ 1,30 a mais.")).toBeTruthy();
  });

  it("sem pendência, fecha com a versão que a tela mostrou", async () => {
    const s = spy();
    render(
      <CloseTabForm tab={{ id: "t12", version: 5, remaining: "0.00", blockers: [] }} action={s.action} />,
    );
    await click("Fechar conta");
    expect(s.calls).toEqual([{ tabId: "t12", version: "5" }]);
  });
});

describe("pagamentos lançados (spec 011, US2-4 e US2-5)", () => {
  const payments = [
    {
      id: "p1",
      method: "CASH" as const,
      amount: "20.00",
      received: "50.00",
      change: "30.00",
      at: "2026-11-11T21:05:00.000Z",
      byName: "Caixa Carla",
      removedAt: null,
      removedByName: null,
    },
    {
      id: "p2",
      method: "PIX" as const,
      amount: "10.00",
      received: null,
      change: null,
      at: "2026-11-11T21:06:00.000Z",
      byName: "Caixa Carla",
      removedAt: "2026-11-11T21:12:00.000Z",
      removedByName: "Gerente Gil",
    },
  ];

  it("cada pagamento com forma, valor, troco, quem e quando; o tirado vem riscado com quem tirou", () => {
    render(<PaymentList tabId="t12" payments={payments} timezone="America/Sao_Paulo" />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]!.textContent).toContain("Dinheiro");
    expect(items[0]!.textContent).toContain("Recebido R$ 50,00, troco R$ 30,00");
    expect(items[0]!.textContent).toContain("18:05 · Caixa Carla");
    expect(items[1]!.querySelector("del")?.textContent).toContain("R$ 10,00");
    expect(items[1]!.textContent).toContain("Tirado às 18:12 por Gerente Gil");
    expect(screen.queryByRole("button", { name: /Tirar/ })).toBeNull();
  });

  it("tirar pede confirmação e só então envia", async () => {
    const s = spy();
    render(<PaymentList tabId="t12" payments={payments} timezone="America/Sao_Paulo" remove={s.action} />);
    await click("Tirar pagamento de R$ 20,00 (Dinheiro)");
    expect(screen.getByText("Tirar o pagamento de R$ 20,00 em Dinheiro?")).toBeTruthy();
    expect(s.calls).toEqual([]);
    await click("Sim, tirar");
    expect(s.calls).toEqual([{ tabId: "t12", paymentId: "p1" }]);
  });

  it("sem pagamentos diz isso", () => {
    render(<PaymentList tabId="t12" payments={[]} timezone="America/Sao_Paulo" />);
    expect(screen.getByText("Nenhum pagamento lançado.")).toBeTruthy();
  });
});
