// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { actionSpy, clickButton } from "@/components/forms/testing";
import { EntriesList } from "./entries-list";
import type { EntryView } from "./view";

afterEach(cleanup);

const TZ = "America/Sao_Paulo";
const withdrawal: EntryView = {
  id: "e1",
  kind: "WITHDRAWAL",
  amount: "150.00",
  reason: "SAFE",
  note: "Malote da tarde",
  at: "2026-11-17T14:30:00.000Z",
  byName: "Ana",
  removedAt: null,
  removedByName: null,
};
const supply: EntryView = {
  ...withdrawal,
  id: "e2",
  kind: "SUPPLY",
  amount: "50.00",
  reason: null,
  note: null,
  removedAt: "2026-11-17T14:40:00.000Z",
  removedByName: "Bruno",
};
const items = () => screen.getAllByRole("listitem");

describe("sangrias e reforços do turno (spec 014, US3-4 e US3-5)", () => {
  it("lista vazia explica", () => {
    render(<EntriesList entries={[]} timezone={TZ} />);
    expect(screen.getByText("Nenhuma sangria ou reforço neste turno.")).toBeTruthy();
  });

  it("cada lançamento com tipo, motivo, valor, hora, quem e observação; o tirado fica riscado", () => {
    render(<EntriesList entries={[withdrawal, supply]} timezone={TZ} remove={actionSpy().action} />);
    const [first, second] = items();
    expect(within(first!).getByText("Sangria · Cofre")).toBeTruthy();
    expect(within(first!).getByText("R$ 150,00").tagName).toBe("STRONG");
    expect(within(first!).getByText("11:30 · Ana")).toBeTruthy();
    expect(within(first!).getByText("Malote da tarde")).toBeTruthy();
    expect(within(first!).getByRole("link", { name: "Comprovante" }).getAttribute("href")).toBe(
      "/caixa/lancamentos/e1/imprimir",
    );
    expect(within(second!).getByText("Reforço")).toBeTruthy();
    expect(within(second!).getByText("R$ 50,00").tagName).toBe("DEL");
    expect(within(second!).getByText("Tirado às 11:40 por Bruno")).toBeTruthy();
    expect(within(second!).queryByRole("button")).toBeNull();
    expect(within(second!).queryByRole("link")).toBeNull();
  });

  it("Tirar pede confirmação e manda o lançamento; Voltar desiste", async () => {
    const s = actionSpy();
    render(<EntriesList entries={[withdrawal]} timezone={TZ} remove={s.action} />);
    await clickButton("Tirar sangria de R$ 150,00");
    expect(screen.getByText("Tirar a sangria de R$ 150,00?")).toBeTruthy();
    await clickButton("Voltar");
    expect(screen.queryByText("Tirar a sangria de R$ 150,00?")).toBeNull();
    await clickButton("Tirar sangria de R$ 150,00");
    await clickButton("Sim, tirar");
    expect(s.calls).toEqual([{ entryId: "e1" }]);
  });

  it("sem a ação (turno fechado ou quem só vê) não há Tirar nem comprovante", () => {
    render(
      <EntriesList
        entries={[{ ...supply, removedAt: null, removedByName: null, byName: null }]}
        timezone={TZ}
        receipts={false}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("11:30")).toBeTruthy();
  });

  it("confirmação do reforço fala em reforço", async () => {
    render(
      <EntriesList
        entries={[{ ...supply, removedAt: null, removedByName: null }]}
        timezone={TZ}
        remove={actionSpy().action}
      />,
    );
    await clickButton("Tirar reforço de R$ 50,00");
    expect(screen.getByText("Tirar o reforço de R$ 50,00?")).toBeTruthy();
  });
});
