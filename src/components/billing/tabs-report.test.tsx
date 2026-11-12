// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";
import { ReopenTabForm, TabsReport } from "./tabs-report";

afterEach(cleanup);

const report = {
  tabs: [
    {
      id: "t13",
      tableName: "13",
      openedAt: "2026-11-11T21:40:00.000Z",
      closedAt: "2026-11-11T22:05:00.000Z",
      closedByName: "Caixa Carla",
      subtotal: "9.00",
      serviceCharge: "0.90",
      total: "9.90",
    },
    {
      id: "t12",
      tableName: "12",
      openedAt: "2026-11-11T20:25:00.000Z",
      closedAt: "2026-11-11T21:10:00.000Z",
      closedByName: "Caixa Carla",
      subtotal: "77.00",
      serviceCharge: "7.70",
      total: "84.70",
    },
  ],
  summary: {
    byMethod: [
      { method: "CASH" as const, amount: "34.70" },
      { method: "PIX" as const, amount: "50.00" },
      { method: "CREDIT_CARD" as const, amount: "9.90" },
    ],
    serviceCharge: "8.60",
    total: "94.60",
  },
};

describe("contas fechadas (spec 011, US6)", () => {
  it("cada conta com o dia, a mesa, quando abriu e fechou, quem fechou, taxa e total, com link", () => {
    render(<TabsReport {...report} timezone="America/Sao_Paulo" />);
    const rows = within(screen.getByRole("table", { name: "Contas fechadas" })).getAllByRole("row").slice(1);
    expect(rows.map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent))).toEqual([
      ["11/11/2026", "Mesa 13", "18:40", "19:05", "Caixa Carla", "R$ 0,90", "R$ 9,90"],
      ["11/11/2026", "Mesa 12", "17:25", "18:10", "Caixa Carla", "R$ 7,70", "R$ 84,70"],
    ]);
    expect(screen.getByRole("link", { name: "Mesa 12" }).getAttribute("href")).toBe("/caixa/t12");
  });

  it("resumo por forma de pagamento, a taxa e o total do período", () => {
    render(<TabsReport {...report} timezone="America/Sao_Paulo" />);
    const summary = screen.getByRole("region", { name: "Resumo do período" });
    expect(within(summary).getAllByRole("row").map((r) => r.textContent)).toEqual([
      "DinheiroR$ 34,70",
      "PixR$ 50,00",
      "Cartão de créditoR$ 9,90",
      "Taxa de serviçoR$ 8,60",
      "Total das contasR$ 94,60",
    ]);
    expect(within(summary).getByText("2 contas fechadas")).toBeTruthy();
  });

  it("sem contas no período diz isso", () => {
    render(
      <TabsReport
        tabs={[]}
        summary={{ byMethod: [], serviceCharge: "0.00", total: "0.00" }}
        timezone="America/Sao_Paulo"
      />,
    );
    expect(screen.getByText("Nenhuma conta fechada no período.")).toBeTruthy();
  });
});

describe("reabrir conta (spec 011, US6)", () => {
  it("pede o motivo antes de reabrir e envia com a versão", async () => {
    const calls: Record<string, string>[] = [];
    const action = async (_p: ActionState, form: FormData): Promise<ActionState> => {
      calls.push(Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])));
      return { ok: true, data: null, at: 1 };
    };
    render(<ReopenTabForm tab={{ id: "t12", version: 9 }} action={action} />);
    expect(screen.queryByLabelText("Motivo da reabertura")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reabrir conta" }));
    const reason = screen.getByLabelText("Motivo da reabertura") as HTMLTextAreaElement;
    expect(reason.maxLength).toBe(140);
    fireEvent.change(reason, { target: { value: "Cliente pediu a conta em dois CPFs" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirmar reabertura" }));
    });
    expect(calls).toEqual([{ tabId: "t12", version: "9", reason: "Cliente pediu a conta em dois CPFs" }]);
  });
});
