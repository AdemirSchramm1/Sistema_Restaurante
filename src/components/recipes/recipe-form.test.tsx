// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, render, screen, fireEvent, within } from "@testing-library/react";
import { RecipeForm } from "./recipe-form";
import { emptyRecipeValues } from "./recipe-form-values";

afterEach(cleanup);

const OPTIONS = {
  items: [
    { id: "pao", label: "Pão de hambúrguer", unit: "un" as const },
    { id: "carne", label: "Carne moída", unit: "kg" as const },
    { id: "leite", label: "Leite", unit: "l" as const },
  ],
  preps: [{ id: "molho", label: "Molho de tomate", unit: "kg" as const }],
};

const noop = async () => null;
const renderForm = (over: Partial<Parameters<typeof RecipeForm>[0]> = {}) =>
  render(
    <RecipeForm action={noop} options={OPTIONS} initial={emptyRecipeValues} submitLabel="Salvar" {...over} />,
  );

const optionValues = (el: HTMLElement) =>
  [...(el as HTMLSelectElement).options].map((o) => o.value).filter(Boolean);

describe("formulário de produto (spec 003, US1)", () => {
  it("pergunta nome, tipo e o que vai nele, em linguagem do dia a dia", () => {
    const { container } = renderForm();
    expect(screen.getByLabelText("Nome do produto")).toBeTruthy();
    expect(screen.getByLabelText("Tipo")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "O que vai nele" })).toBeTruthy();
    expect(screen.getByLabelText("Item ou preparo da linha 1")).toBeTruthy();
    expect(screen.getByLabelText("Quanto vai (linha 1)")).toBeTruthy();
    expect(screen.getByLabelText("Medida (linha 1)")).toBeTruthy();
    expect(container.textContent).not.toMatch(/ficha técnica|FC\b|CMV|fator/i);
  });

  it("lista itens e preparos separados", () => {
    renderForm();
    const select = screen.getByLabelText("Item ou preparo da linha 1");
    expect(optionValues(select)).toEqual(["ITEM:pao", "ITEM:carne", "ITEM:leite", "RECIPE:molho"]);
    expect(within(select).getByRole("group", { name: "Preparos" })).toBeTruthy();
  });

  it("a medida da linha só oferece a mesma família do item (g ou kg para carne)", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Item ou preparo da linha 1"), {
      target: { value: "ITEM:carne" },
    });
    const unit = screen.getByLabelText("Medida (linha 1)") as HTMLSelectElement;
    expect(optionValues(unit)).toEqual(["g", "kg"]);
    expect(unit.value).toBe("kg");
    fireEvent.change(screen.getByLabelText("Item ou preparo da linha 1"), { target: { value: "ITEM:pao" } });
    expect(optionValues(screen.getByLabelText("Medida (linha 1)"))).toEqual(["un"]);
  });

  it("adiciona e tira linhas", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar item ou preparo" }));
    expect(screen.getByLabelText("Item ou preparo da linha 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tirar a linha 1" }));
    expect(screen.queryByLabelText("Item ou preparo da linha 2")).toBeNull();
    expect(screen.getByLabelText("Item ou preparo da linha 1")).toBeTruthy();
  });

  it("só o preparo pergunta quanto rende", () => {
    renderForm();
    expect(screen.queryByLabelText("Quanto rende")).toBeNull();
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "SUB_RECIPE" } });
    expect(screen.getByLabelText("Quanto rende")).toBeTruthy();
    expect(screen.getByLabelText("Medida do rendimento")).toBeTruthy();
  });

  it("não oferece o próprio preparo dentro dele", () => {
    renderForm({ meta: { id: "molho", version: 1 } });
    expect(optionValues(screen.getByLabelText("Item ou preparo da linha 1"))).not.toContain("RECIPE:molho");
  });
});

describe("formulário de produto depois de erro do servidor", () => {
  it("mantém as linhas e mostra o erro na quantidade da linha certa", async () => {
    const failing = async () => ({
      ok: false as const,
      error: {
        code: "INVALID_QUANTITY" as const,
        field: "lines.1.quantity",
        message: "Quantidade inválida.",
      },
      at: 1,
    });
    renderForm({ action: failing, submitLabel: "Cadastrar produto" });
    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "X-Burger" } });
    fireEvent.change(screen.getByLabelText("Item ou preparo da linha 1"), { target: { value: "ITEM:pao" } });
    fireEvent.change(screen.getByLabelText("Quanto vai (linha 1)"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar item ou preparo" }));
    fireEvent.change(screen.getByLabelText("Item ou preparo da linha 2"), {
      target: { value: "ITEM:carne" },
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole("form", { name: "Cadastro do produto" }));
    });
    const qty2 = screen.getByLabelText("Quanto vai (linha 2)");
    expect(qty2.getAttribute("aria-invalid")).toBe("true");
    expect((await screen.findAllByText("Quantidade inválida.")).length).toBeGreaterThan(0);
    expect((screen.getByLabelText("Nome do produto") as HTMLInputElement).value).toBe("X-Burger");
    expect((screen.getByLabelText("Quanto vai (linha 1)") as HTMLInputElement).value).toBe("1");
  });
});
