// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { TabDetail, type TabDetailView } from "./tab-detail";

afterEach(cleanup);

const tab = (over: Partial<TabDetailView> = {}): TabDetailView => ({
  id: "t12",
  tableName: "12",
  status: "OPEN",
  openedAt: "2026-11-11T20:25:00.000Z",
  closedAt: null,
  closedByName: null,
  orders: [
    {
      id: "o7",
      number: 7,
      status: "DELIVERED",
      cancelReason: null,
      cancelNote: null,
      total: "68.00",
      lines: [
        {
          quantity: 2,
          productName: "X-Burger",
          unitPrice: "34.00",
          changes: ["+ 2 Fatia de queijo", "SEM cebola"],
        },
      ],
    },
    {
      id: "o8",
      number: 8,
      status: "READY",
      cancelReason: null,
      cancelNote: null,
      total: "9.00",
      lines: [{ quantity: 1, productName: "Suco", unitPrice: "9.00", changes: [] }],
    },
    {
      id: "o9",
      number: 9,
      status: "CANCELLED",
      cancelReason: "CUSTOMER_GAVE_UP",
      cancelNote: null,
      total: "9.00",
      lines: [{ quantity: 1, productName: "Suco", unitPrice: "9.00", changes: [] }],
    },
  ],
  subtotal: "77.00",
  serviceRate: "10",
  serviceWaived: false,
  serviceCharge: "7.70",
  total: "84.70",
  paid: "0.00",
  remaining: "84.70",
  pendingOrders: 1,
  blockers: ["REMAINING_NOT_ZERO", "PENDING_ORDERS"],
  payments: [],
  events: [{ kind: "OPENED", reason: null, userName: null, at: "2026-11-11T20:25:00.000Z" }],
  ...over,
});

const summary = () =>
  within(screen.getByRole("region", { name: "Total da conta" }))
    .getAllByRole("row")
    .map((r) => r.textContent);

describe("conta da mesa (spec 011, US1)", () => {
  it("linhas com as mudanças do cliente e o preço", () => {
    render(<TabDetail tab={tab()} timezone="America/Sao_Paulo" />);
    const order = screen.getByRole("article", { name: "Pedido 7" });
    expect(within(order).getByText("2 × X-Burger")).toBeTruthy();
    expect(within(order).getByText("+ 2 Fatia de queijo")).toBeTruthy();
    expect(within(order).getByText("SEM").parentElement?.textContent).toBe("SEM cebola");
    expect(within(order).getByText("R$ 68,00")).toBeTruthy();
  });

  it("cada pedido diz quem lançou e mostra a observação (spec 015)", () => {
    const [o7, o8, o9] = tab().orders;
    render(
      <TabDetail
        tab={tab({
          orders: [
            {
              ...o7!,
              source: "STAFF",
              placedByName: "João",
              lines: [{ ...o7!.lines[0]!, kitchenNote: "bem passado" }],
            },
            { ...o8!, source: "QR", placedByName: null },
            o9!,
          ],
        })}
        timezone="America/Sao_Paulo"
      />,
    );
    const seven = screen.getByRole("article", { name: "Pedido 7" });
    expect(within(seven).getByText("João")).toBeTruthy();
    expect(within(seven).getByText(/bem passado/)).toBeTruthy();
    expect(within(screen.getByRole("article", { name: "Pedido 8" })).getByText("QR code")).toBeTruthy();
  });

  it("pedido não entregue mostra a situação; cancelado vem riscado, com o motivo, fora do total", () => {
    render(<TabDetail tab={tab()} timezone="America/Sao_Paulo" />);
    expect(within(screen.getByRole("article", { name: "Pedido 8" })).getByText("Pronto")).toBeTruthy();
    const cancelled = screen.getByRole("article", { name: "Pedido 9 (cancelado)" });
    expect(within(cancelled).getByText("Cancelado: Cliente desistiu")).toBeTruthy();
    expect(cancelled.querySelector("del")?.textContent).toContain("R$ 9,00");
    expect(screen.getByText("1 pedido ainda não foi entregue")).toBeTruthy();
  });

  it("subtotal, serviço com a porcentagem, total, pago e falta", () => {
    render(<TabDetail tab={tab()} timezone="America/Sao_Paulo" />);
    expect(summary()).toEqual([
      "SubtotalR$ 77,00",
      "Serviço 10%R$ 7,70",
      "TotalR$ 84,70",
      "PagoR$ 0,00",
      "FaltaR$ 84,70",
    ]);
  });

  it("taxa tirada aparece como tirada; restaurante sem taxa não mostra a linha", () => {
    render(
      <TabDetail
        tab={tab({ serviceWaived: true, serviceCharge: "0.00", total: "77.00" })}
        timezone="America/Sao_Paulo"
      />,
    );
    expect(summary()[1]).toBe("Serviço 10% (tirado)R$ 0,00");
    cleanup();
    render(
      <TabDetail
        tab={tab({ serviceRate: null, serviceCharge: "0.00", total: "77.00" })}
        timezone="America/Sao_Paulo"
      />,
    );
    expect(summary().some((r) => r?.startsWith("Serviço"))).toBe(false);
  });

  it("pago a mais (pedido cancelado depois de pago) diz quanto e o que fazer", () => {
    render(<TabDetail tab={tab({ paid: "86.00", remaining: "-1.30" })} timezone="America/Sao_Paulo" />);
    expect(summary()[4]).toBe("Pago a maisR$ 1,30");
    expect(screen.getByText("Tire um pagamento e lance de novo com o valor certo.")).toBeTruthy();
  });

  it("conta fechada mostra quem fechou e quando", () => {
    render(
      <TabDetail
        tab={tab({
          status: "CLOSED",
          closedAt: "2026-11-11T21:10:00.000Z",
          closedByName: "Caixa Carla",
          blockers: [],
        })}
        timezone="America/Sao_Paulo"
      />,
    );
    expect(screen.getByText("Fechada às 18:10 por Caixa Carla")).toBeTruthy();
  });

  it("fechada em outro dia diz a data; sem nome, só a hora", () => {
    render(
      <TabDetail
        tab={tab({ status: "CLOSED", closedAt: "2026-11-12T04:05:00.000Z", blockers: [] })}
        timezone="America/Sao_Paulo"
      />,
    );
    expect(screen.getByText("Fechada em 12/11/2026 às 01:05")).toBeTruthy();
  });

  it("histórico em ordem, com hora, o que aconteceu e quem fez", () => {
    const at = "2026-11-11T21:00:00.000Z";
    render(
      <TabDetail
        tab={tab({
          events: [
            { kind: "OPENED", reason: null, userName: null, at: "2026-11-11T20:25:00.000Z" },
            {
              kind: "PAYMENT_ADDED",
              reason: null,
              details: { amount: "50.00", method: "PIX" },
              userName: "Carla",
              at,
            },
            {
              kind: "PAYMENT_REMOVED",
              reason: null,
              details: { amount: "50.00", method: "CASH" },
              userName: "Carla",
              at,
            },
            { kind: "SERVICE_WAIVED", reason: null, userName: "Carla", at },
            { kind: "SERVICE_RESTORED", reason: null, userName: "Carla", at },
            { kind: "CLOSED", reason: null, details: { total: "84.70" }, userName: "Carla", at },
            { kind: "REOPENED", reason: "Cobrou errado", userName: "Gerente Gil", at },
            { kind: "OUTRO", reason: null, userName: "Carla", at },
          ],
        })}
        timezone="America/Sao_Paulo"
      />,
    );
    const history = screen.getByText("Histórico da conta").parentElement!;
    expect(
      within(history)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "17:25 · Conta aberta pelo primeiro pedido · Cliente pelo QR code",
      "18:00 · Pagamento lançado: R$ 50,00, Pix · Carla",
      "18:00 · Pagamento tirado: R$ 50,00, Dinheiro · Carla",
      "18:00 · Taxa de serviço tirada · Carla",
      "18:00 · Taxa de serviço posta de volta · Carla",
      "18:00 · Conta fechada: R$ 84,70 · Carla",
      "18:00 · Conta reaberta. Motivo: Cobrou errado · Gerente Gil",
      "18:00 · OUTRO · Carla",
    ]);
  });
});

describe("conta da mesa: casos raros (spec 018, US1)", () => {
  it("cancelado com observação; detalhe faltando no histórico não quebra a tela", () => {
    render(
      <TabDetail
        tab={tab({
          orders: [
            {
              id: "o9",
              number: 9,
              status: "CANCELLED",
              cancelReason: "OTHER",
              cancelNote: "pediu outro",
              total: "9.00",
              lines: [{ quantity: 1, productName: "Suco", unitPrice: "9.00", changes: [] }],
            },
          ],
          events: [
            { kind: "PAYMENT_ADDED", reason: null, userName: "Carla", at: "2026-11-11T21:00:00.000Z" },
            {
              kind: "PAYMENT_REMOVED",
              reason: null,
              details: { amount: 50, method: "CHEQUE" },
              userName: "Carla",
              at: "2026-11-11T21:00:00.000Z",
            },
            { kind: "REOPENED", reason: null, userName: "Gil", at: "2026-11-11T21:00:00.000Z" },
          ],
        })}
        timezone="America/Sao_Paulo"
      />,
    );
    expect(screen.getByText(/^Cancelado: .+ \(pediu outro\)$/)).toBeTruthy();
    const history = screen.getByText("Histórico da conta").parentElement!;
    expect(
      within(history)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "18:00 · Pagamento lançado: ,  · Carla",
      "18:00 · Pagamento tirado: ,  · Carla",
      "18:00 · Conta reaberta. Motivo:  · Gil",
    ]);
  });
});
