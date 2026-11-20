// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { SessionsList } from "./sessions-list";
import type { SessionRowView } from "./view";

afterEach(cleanup);

const closed: SessionRowView = {
  id: "s1",
  businessDay: "2026-11-17",
  status: "CLOSED",
  openedAt: "2026-11-17T14:02:00.000Z",
  openedByName: "Ana",
  closedAt: "2026-11-18T02:10:00.000Z",
  closedByName: "Bruno",
  received: "117.00",
  difference: "-2.00",
  result: "SHORT",
};
const rows = () => screen.getAllByRole("row").slice(1);
const show = (sessions: SessionRowView[]) =>
  render(<SessionsList sessions={sessions} timezone="America/Sao_Paulo" />);

describe("lista de turnos (spec 014, US5)", () => {
  it("cada turno com dia, abertura, fechamento, quem, recebido e o resultado com link", () => {
    show([closed]);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Dia",
      "Abertura",
      "Fechamento",
      "Recebido",
      "Conferência",
    ]);
    const [row] = rows();
    expect(within(row!).getByRole("link", { name: "17/11/2026" }).getAttribute("href")).toBe(
      "/caixa/turnos/s1",
    );
    expect(within(row!).getByText("11:02 · Ana")).toBeTruthy();
    expect(within(row!).getByText("23:10 · Bruno")).toBeTruthy();
    expect(within(row!).getByText("R$ 117,00")).toBeTruthy();
    expect(within(row!).getByText("Falta R$ 2,00").className).toContain("bg-danger-soft");
  });

  it("selo Bateu em verde, Sobra em azul e turno aberto sem conferência", () => {
    show([
      { ...closed, id: "a", difference: "0.00", result: "BALANCED" },
      { ...closed, id: "b", difference: "3.00", result: "OVER", closedByName: null, openedByName: null },
      {
        ...closed,
        id: "c",
        status: "OPEN",
        closedAt: null,
        closedByName: null,
        difference: null,
        result: null,
      },
    ]);
    const [balanced, over, open] = rows();
    expect(within(balanced!).getByText("Bateu").className).toContain("bg-success-soft");
    expect(within(over!).getByText("Sobra R$ 3,00").className).toContain("bg-info-soft");
    expect(within(over!).getByText("11:02")).toBeTruthy();
    expect(within(over!).getByText("23:10")).toBeTruthy();
    expect(within(open!).getByText("Aberto").className).toContain("bg-warning-soft");
    expect(within(open!).getByText("Caixa aberto")).toBeTruthy();
  });

  it("lista vazia explica o que fazer", () => {
    show([]);
    expect(screen.getByText("Nenhum turno neste período")).toBeTruthy();
    expect(screen.getByText(/Escolha outras datas ou abra o caixa na tela Caixa/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
