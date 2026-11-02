// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HistoryList } from "./history-list";

afterEach(cleanup);

const entry = (changes: Record<string, [unknown, unknown]>) => ({
  entity: "item",
  entityId: "i1",
  action: "UPDATE" as const,
  changes,
  userId: "u1",
  userName: "Ana",
  occurredAt: new Date("2026-11-01T17:30:00Z"),
});

describe("histórico (FR-004)", () => {
  it("mostra o nome do campo em português e números com vírgula", () => {
    render(
      <HistoryList
        timezone="America/Sao_Paulo"
        entries={[
          entry({
            description: ["Tomate", "Tomate italiano"],
            purchaseUnitLabel: [null, "Caixa"],
            purchaseFactor: [null, "12.5"],
            stockUnit: ["kg", "un"],
          }),
        ]}
      />,
    );
    expect(screen.getByText("Nome do item: Tomate → Tomate italiano")).toBeTruthy();
    expect(screen.getByText("Embalagem: — → Caixa")).toBeTruthy();
    expect(screen.getByText("Quanto vem na embalagem: — → 12,5")).toBeTruthy();
    expect(screen.getByText("Medida: kg → un")).toBeTruthy();
  });

  it("campos antigos, já retirados do cadastro, ainda aparecem com nome em português", () => {
    render(
      <HistoryList
        timezone="America/Sao_Paulo"
        entries={[entry({ correctionFactor: ["1", "1.25"], lotControl: [false, true] })]}
      />,
    );
    expect(screen.getByText("Fator de correção: 1 → 1,25")).toBeTruthy();
    expect(screen.getByText("Controla lote: não → sim")).toBeTruthy();
  });

  it("traduz tipo e quem está no CMV; ids aparecem só como alterados", () => {
    render(
      <HistoryList
        timezone="America/Sao_Paulo"
        entries={[
          entry({
            type: ["INGREDIENT", "RESALE"],
            subgroupId: ["a", "b"],
            inCogsOverride: [null, false],
          }),
        ]}
      />,
    );
    expect(screen.getByText("Tipo: Ingrediente → Revenda")).toBeTruthy();
    expect(screen.getByText("Subgrupo: alterado")).toBeTruthy();
    expect(screen.getByText("Entra no CMV: segue o grupo → não")).toBeTruthy();
  });

  it("data e hora no fuso do restaurante", () => {
    render(<HistoryList timezone="America/Sao_Paulo" entries={[entry({ description: ["abc", "abcd"] })]} />);
    expect(screen.getByText(/01\/11\/2026, 14:30:00/)).toBeTruthy();
  });

  it("mostra as mudanças do produto em português (spec 003)", () => {
    render(
      <HistoryList
        timezone="America/Sao_Paulo"
        entries={[
          entry({
            kind: ["DISH", "SUB_RECIPE"],
            yield: [null, "2 kg"],
            lines: ["Pão: 1 un", "Pão: 2 un"],
          }),
        ]}
      />,
    );
    expect(
      screen.getByText("Tipo: Vendido ao cliente → Preparo (usado dentro de outros produtos)"),
    ).toBeTruthy();
    expect(screen.getByText("Quanto rende: — → 2 kg")).toBeTruthy();
    expect(screen.getByText("O que vai nele: Pão: 1 un → Pão: 2 un")).toBeTruthy();
  });
});
