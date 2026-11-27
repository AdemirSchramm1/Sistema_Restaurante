// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProductCustomization, type ProductCustomizationProps } from "./product-customization";

afterEach(cleanup);

const base: ProductCustomizationProps = {
  recipeId: "r1",
  kind: "DISH",
  version: 4,
  addons: [{ addonId: "a1", name: "Fatia de queijo", price: "3.00", maxTimes: 2 }],
  removables: [{ component: "ITEM:cebola", name: "Cebola", label: "Sem cebola", orphan: false }],
  candidates: [
    { component: "ITEM:pao", name: "Pão" },
    { component: "ITEM:cebola", name: "Cebola" },
    { component: "ITEM:picles", name: "Picles" },
  ],
  available: [
    { addonId: "a1", name: "Fatia de queijo", price: "3.00" },
    { addonId: "a2", name: "Bacon", price: "4.00" },
    { addonId: "a3", name: "Gelo", price: "0.00" },
  ],
  canEdit: true,
  action: async () => null,
};

describe("quadro 'Adicionar e tirar' (spec 010, US2)", () => {
  it("mostra as duas listas com o máximo de cada adicional e o texto do botão", () => {
    render(<ProductCustomization {...base} />);
    const add = screen.getByRole("group", { name: "Adicionar" });
    expect(within(add).getByText("Fatia de queijo")).toBeTruthy();
    expect(within(add).getByText("R$ 3,00")).toBeTruthy();
    expect(
      (within(add).getByLabelText("Até quantas vezes: Fatia de queijo") as HTMLSelectElement).value,
    ).toBe("2");
    const remove = screen.getByRole("group", { name: "Tirar" });
    expect((within(remove).getByLabelText("Texto do botão: Cebola") as HTMLInputElement).value).toBe(
      "Sem cebola",
    );
  });

  it("liga outro adicional e outra retirada; grátis aparece como Grátis", () => {
    render(<ProductCustomization {...base} />);
    expect(screen.getByRole("option", { name: "Gelo · Grátis" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Ligar adicional"), { target: { value: "a2" } });
    fireEvent.click(screen.getByRole("button", { name: "Ligar" }));
    expect(screen.getByLabelText("Até quantas vezes: Bacon")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Deixar tirar"), { target: { value: "ITEM:picles" } });
    fireEvent.click(screen.getByRole("button", { name: "Deixar tirar" }));
    expect((screen.getByLabelText("Texto do botão: Picles") as HTMLInputElement).placeholder).toBe(
      "Sem picles",
    );
  });

  it("muda o texto do botão e tira da lista", () => {
    render(<ProductCustomization {...base} />);
    const input = screen.getByLabelText("Texto do botão: Cebola") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Sem cebola roxa" } });
    expect(input.value).toBe("Sem cebola roxa");
    fireEvent.click(screen.getByRole("button", { name: "Remover Cebola da lista" }));
    expect(screen.queryByLabelText("Texto do botão: Cebola")).toBeNull();
  });

  it("avisa quando o ingrediente saiu do produto", () => {
    render(
      <ProductCustomization
        {...base}
        removables={[{ component: "ITEM:x", name: "Cebola", label: "Sem cebola", orphan: true }]}
      />,
    );
    expect(screen.getByText(/Cebola saiu do produto/)).toBeTruthy();
  });

  it("não aparece em preparo", () => {
    const { container } = render(<ProductCustomization {...base} kind="SUB_RECIPE" />);
    expect(container.innerHTML).toBe("");
  });

  it("chef vê sem mudar", () => {
    render(<ProductCustomization {...base} canEdit={false} />);
    expect(screen.getByText("Fatia de queijo")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salvar quadro" })).toBeNull();
    expect(screen.queryByLabelText("Ligar adicional")).toBeNull();
  });

  it("muda o máximo e desliga um adicional sem mexer nos outros; sem adicionais avisa", () => {
    render(
      <ProductCustomization
        {...base}
        addons={[
          { addonId: "a1", name: "Fatia de queijo", price: "3.00", maxTimes: 2 },
          { addonId: "a2", name: "Bacon", price: "4.00", maxTimes: 1 },
        ]}
        removables={[
          { component: "ITEM:cebola", name: "Cebola", label: "Sem cebola", orphan: false },
          { component: "ITEM:picles", name: "Picles", label: "", orphan: false },
        ]}
      />,
    );
    const add = screen.getByRole("group", { name: "Adicionar" });
    const max = (name: string) =>
      within(add).getByLabelText(`Até quantas vezes: ${name}`) as HTMLSelectElement;
    fireEvent.change(max("Bacon"), { target: { value: "3" } });
    expect([max("Fatia de queijo").value, max("Bacon").value]).toEqual(["2", "3"]);
    expect(within(add).getAllByText("vezes")).toHaveLength(2);
    const remove = screen.getByRole("group", { name: "Tirar" });
    fireEvent.change(within(remove).getByLabelText("Texto do botão: Picles"), {
      target: { value: "Sem picles" },
    });
    expect((within(remove).getByLabelText("Texto do botão: Cebola") as HTMLInputElement).value).toBe(
      "Sem cebola",
    );
    fireEvent.click(within(add).getByRole("button", { name: "Desligar Fatia de queijo" }));
    fireEvent.click(within(add).getByRole("button", { name: "Desligar Bacon" }));
    expect(within(add).getByText("Nenhum adicional ligado.")).toBeTruthy();
  });

  it("recusa do servidor aparece em cima; salvo avisa", async () => {
    const results = [
      {
        ok: false as const,
        error: { code: "STALE_RECORD" as const, message: "Alguém mudou o produto." },
        at: 1,
      },
      { ok: true as const, data: null, at: 2 },
    ];
    render(<ProductCustomization {...base} action={async () => results.shift()!} />);
    const form = screen.getByRole("form", { name: "Quadro adicionar e tirar" });
    await act(async () => {
      fireEvent.submit(form);
    });
    expect((await screen.findAllByText("Alguém mudou o produto.")).length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(await screen.findByText("Quadro salvo.")).toBeTruthy();
  });
});
