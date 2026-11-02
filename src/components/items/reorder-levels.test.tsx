// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReorderLevels, type ReorderLevelsProps } from "./reorder-levels";

afterEach(cleanup);

const noop = async () => null;
const base: ReorderLevelsProps = {
  id: "i1",
  version: 2,
  unit: "kg",
  reorderPoint: "20",
  parLevel: "50",
  atReorderPoint: false,
  suggestion: null,
  canEdit: true,
  action: noop,
};
const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;

describe("quadro do aviso de reposição (spec 006, US1)", () => {
  it("mostra os campos com a medida do item e os valores salvos", () => {
    render(<ReorderLevels {...base} />);
    expect(value("Avisar quando chegar em (kg)")).toBe("20");
    expect(value("Comprar até (kg)")).toBe("50");
    expect(screen.getByRole("button", { name: "Salvar aviso" })).toBeTruthy();
    expect(screen.queryByText(/Chegou no ponto/)).toBeNull();
  });

  it("avisa quando o item chegou no ponto", () => {
    render(<ReorderLevels {...base} atReorderPoint />);
    expect(screen.getByText(/Chegou no ponto/)).toBeTruthy();
  });

  it("sem consumo explica quando a sugestão aparece", () => {
    render(<ReorderLevels {...base} />);
    expect(screen.getByText(/sugestão aparece quando o item tiver saídas/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Usar sugestão" })).toBeNull();
  });

  it("'Usar sugestão' preenche os dois campos", () => {
    render(
      <ReorderLevels
        {...base}
        reorderPoint={null}
        parLevel={null}
        suggestion={{
          reorderPoint: "2,55",
          parLevel: "6,3",
          averageDailyUsage: "1,5",
          leadTimeDays: 1,
          cycleDays: "3,5",
        }}
      />,
    );
    expect(screen.getByText(/1,5 kg por dia/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Usar sugestão" }));
    expect(value("Avisar quando chegar em (kg)")).toBe("2,55");
    expect(value("Comprar até (kg)")).toBe("6,3");
  });

  it("quem não pode editar só vê os valores", () => {
    render(<ReorderLevels {...base} canEdit={false} />);
    expect(screen.queryByRole("button", { name: "Salvar aviso" })).toBeNull();
    expect(screen.getByText(/Avisar quando chegar em: 20 kg/)).toBeTruthy();
    expect(screen.getByText(/Comprar até: 50 kg/)).toBeTruthy();
  });

  it("sem aviso definido diz que está desligado", () => {
    render(<ReorderLevels {...base} canEdit={false} reorderPoint={null} parLevel={null} />);
    expect(screen.getByText(/Aviso desligado/)).toBeTruthy();
  });
});
