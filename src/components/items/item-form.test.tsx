// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ItemForm } from "./item-form";
import { emptyItemValues } from "./item-form-values";

afterEach(cleanup);

const noop = async () => null;
const renderForm = (over: Partial<Parameters<typeof ItemForm>[0]> = {}) =>
  render(<ItemForm action={noop} subgroups={[]} initial={emptyItemValues} submitLabel="Salvar" {...over} />);

describe("formulário do item em três perguntas (docs/produto/estoque/02-cadastro-de-itens.md)", () => {
  it("mostra os três blocos com títulos do dia a dia", () => {
    renderForm();
    expect(screen.getByRole("heading", { name: "O que é" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Em que medida você controla este item?" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Como você compra? (opcional)" })).toBeTruthy();
  });

  it("cada campo tem rótulo claro", () => {
    renderForm();
    for (const label of ["Nome do item", "Grupo", "Tipo", "Medida", "Embalagem", "Quanto vem em cada embalagem"])
      expect(screen.getByLabelText(label), label).toBeTruthy();
  });

  it("não pede nada de Anvisa, fiscal, contagem ou receita", () => {
    const { container } = renderForm();
    expect(container.textContent).not.toMatch(
      /temperatura|validade|alérgeno|NCM|CEST|EAN|GTIN|contagem|receita|fator|lote|°C/i,
    );
  });

  it("mostra a frase pronta da embalagem: 1 Caixa = 20 kg", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Embalagem"), { target: { value: "Caixa" } });
    fireEvent.change(screen.getByLabelText("Quanto vem em cada embalagem"), { target: { value: "20" } });
    expect(screen.getByTestId("purchase-summary").textContent).toBe("1 Caixa = 20 kg");
  });

  it("a frase acompanha a medida escolhida", () => {
    renderForm({ initial: { ...emptyItemValues, purchaseUnitLabel: "Fardo", purchaseFactor: "12" } });
    fireEvent.change(screen.getByLabelText("Medida"), { target: { value: "un" } });
    expect(screen.getByTestId("purchase-summary").textContent).toBe("1 Fardo = 12 un");
    expect(screen.getByTestId("purchase-unit").textContent).toBe("un");
  });

  it("sem embalagem, explica que o item é comprado solto", () => {
    renderForm();
    expect(screen.getByTestId("purchase-summary").textContent).toMatch(/comprado solto/);
  });

  it("bloqueia a medida quando o item já movimentou", () => {
    renderForm({ stockUnitLocked: true });
    expect((screen.getByLabelText("Medida") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(/inative o item e crie outro/)).toBeTruthy();
  });
});

describe("formulário do item depois de erro do servidor", () => {
  it("não apaga o nome digitado e mostra o erro no campo certo", async () => {
    const { act } = await import("@testing-library/react");
    const failing = async () => ({
      ok: false as const,
      error: {
        code: "PURCHASE_FACTOR_REQUIRED" as const,
        field: "purchaseFactor",
        message: "Diga quanto vem em cada embalagem.",
      },
      at: 1,
    });
    renderForm({ action: failing, submitLabel: "Cadastrar item" });
    fireEvent.change(screen.getByLabelText("Nome do item"), { target: { value: "Arroz branco" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("form", { name: "Cadastro do item" }));
    });
    expect((await screen.findAllByText("Diga quanto vem em cada embalagem.")).length).toBeGreaterThan(0);
    expect((screen.getByLabelText("Nome do item") as HTMLInputElement).value).toBe("Arroz branco");
  });
});
