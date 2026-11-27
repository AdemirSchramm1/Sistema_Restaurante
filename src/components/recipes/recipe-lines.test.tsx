// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RecipeLines } from "./recipe-lines";

afterEach(cleanup);

/** Spec 018, US2: as linhas do produto (também a versão de toque do Cardápio, spec 013). */

const OPTIONS = {
  items: [{ id: "carne", label: "Carne moída", unit: "kg" as const }],
  preps: [{ id: "molho", label: "Molho de tomate", unit: "kg" as const }],
};

const errors: Record<string, string> = {
  lines: "Ponha pelo menos um item.",
  "lines.0.component": "Escolha o item.",
  "lines.0.quantity": "Quantidade inválida.",
  "lines.0.unit": "Medida que não serve para o item.",
};

describe("linhas do produto (spec 003)", () => {
  it("mostra a recusa do servidor em cada campo da linha e no geral", () => {
    render(
      <RecipeLines
        options={OPTIONS}
        initial={[{ component: "", quantity: "", unit: "" }]}
        kind="DISH"
        fe={(f) => errors[f] ?? null}
      />,
    );
    for (const text of Object.values(errors)) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByLabelText("Item ou preparo da linha 1").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Medida (linha 1)").getAttribute("aria-invalid")).toBe("true");
  });

  it("voltar para 'Escolha…' mantém a medida; trocar a medida guarda a escolhida", () => {
    render(
      <RecipeLines
        options={OPTIONS}
        initial={[{ component: "ITEM:carne", quantity: "150", unit: "kg" }]}
        kind="SUB_RECIPE"
        fe={() => null}
        excludeId="molho"
        touch
      />,
    );
    expect(screen.getByText(/Os itens para fazer o rendimento acima/)).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Preparos" })).toBeNull();
    const unit = screen.getByLabelText("Medida (linha 1)") as HTMLSelectElement;
    fireEvent.change(unit, { target: { value: "g" } });
    expect(unit.value).toBe("g");
    fireEvent.change(screen.getByLabelText("Item ou preparo da linha 1"), { target: { value: "" } });
    expect((screen.getByLabelText("Medida (linha 1)") as HTMLSelectElement).value).toBe("g");
  });
});
