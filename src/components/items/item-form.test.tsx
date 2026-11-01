// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ItemForm } from "./item-form";
import { emptyItemValues } from "./item-form-values";

afterEach(cleanup);

const noop = async () => null;

describe("formulário do item (FR-021, FR-022)", () => {
  it("pede a conversão do item quando estoque em un e receita em g", () => {
    render(
      <ItemForm
        action={noop}
        subgroups={[]}
        initial={{ ...emptyItemValues, stockUnit: "un", recipeUnit: "g" }}
        submitLabel="Salvar"
      />,
    );
    expect(screen.getByLabelText(/1 un equivale a quantos g/)).toBeTruthy();
  });

  it("não pede conversão quando as dimensões são iguais (kg e g)", () => {
    render(<ItemForm action={noop} subgroups={[]} initial={emptyItemValues} submitLabel="Salvar" />);
    expect(screen.queryByLabelText(/equivale a quantos/)).toBeNull();
  });

  it("mostra a equivalência das três unidades: 2 caixas = 40 kg = 40.000 g", () => {
    render(
      <ItemForm
        action={noop}
        subgroups={[]}
        initial={{ ...emptyItemValues, purchaseUnitLabel: "Caixa 20 kg", purchaseFactor: "20" }}
        submitLabel="Salvar"
      />,
    );
    fireEvent.change(screen.getByLabelText("Quantidade de compra para simular"), { target: { value: "2" } });
    expect(screen.getByTestId("equivalence").textContent).toBe("= 40 kg = 40.000 g");
  });

  it("bloqueia a unidade de estoque quando o item já movimentou", () => {
    render(
      <ItemForm
        action={noop}
        subgroups={[]}
        initial={emptyItemValues}
        stockUnitLocked
        submitLabel="Salvar"
      />,
    );
    expect((screen.getByLabelText(/Unidade de estoque/) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(/inative o item e crie outro/)).toBeTruthy();
  });
});
