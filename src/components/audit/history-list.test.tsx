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
            presentation: [null, "caixa de madeira"],
            correctionFactor: ["1", "1.25"],
            lotControl: [false, true],
          }),
        ]}
      />,
    );
    expect(screen.getByText("Apresentação: — → caixa de madeira")).toBeTruthy();
    expect(screen.getByText("Fator de correção: 1 → 1,25")).toBeTruthy();
    expect(screen.getByText("Controla lote: não → sim")).toBeTruthy();
  });

  it("traduz alérgenos, tipo e quem está no CMV; ids aparecem só como alterados", () => {
    render(
      <HistoryList
        timezone="America/Sao_Paulo"
        entries={[
          entry({
            allergens: [[], ["MILK"]],
            type: ["INGREDIENT", "RESALE"],
            subgroupId: ["a", "b"],
            inCogsOverride: [null, false],
          }),
        ]}
      />,
    );
    expect(screen.getByText("Alérgenos: — → Leites de todas as espécies de animais mamíferos")).toBeTruthy();
    expect(screen.getByText("Tipo: Insumo → Revenda")).toBeTruthy();
    expect(screen.getByText("Subgrupo: alterado")).toBeTruthy();
    expect(screen.getByText("Entra no CMV: segue o grupo → não")).toBeTruthy();
  });

  it("data e hora no fuso do restaurante", () => {
    render(<HistoryList timezone="America/Sao_Paulo" entries={[entry({ presentation: ["a", "b"] })]} />);
    expect(screen.getByText(/01\/11\/2026, 14:30:00/)).toBeTruthy();
  });
});
