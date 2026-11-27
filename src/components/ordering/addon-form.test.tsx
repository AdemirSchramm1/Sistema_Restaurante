// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AddonForm, type AddonFormProps } from "./addon-form";

afterEach(cleanup);

const base: AddonFormProps = {
  action: async () => null,
  options: {
    items: [{ id: "q", label: "Queijo prato", unit: "kg" }],
    preps: [{ id: "m", label: "Molho da casa", unit: "kg" }],
  },
  initial: { name: "", component: "", quantity: "", unit: "", price: "" },
  submitLabel: "Criar adicional",
};

describe("formulário do adicional (spec 010, US1)", () => {
  it("tem nome, o que vai, quantidade, medida e preço", () => {
    render(<AddonForm {...base} />);
    for (const label of ["Nome do botão", "O que vai", "Quantidade", "Medida", "Preço (R$)"])
      expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByRole("option", { name: "Queijo prato" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Molho da casa" })).toBeTruthy();
  });

  it("ao escolher o queijo, a medida fica na família dele", () => {
    render(<AddonForm {...base} />);
    fireEvent.change(screen.getByLabelText("O que vai"), { target: { value: "ITEM:q" } });
    const units = Array.from((screen.getByLabelText("Medida") as HTMLSelectElement).options).map(
      (o) => o.value,
    );
    expect(units).toEqual(["g", "kg"]);
  });

  it("preço zero aparece como Grátis", () => {
    render(<AddonForm {...base} />);
    expect(screen.queryByText("Grátis no cardápio")).toBeNull();
    fireEvent.change(screen.getByLabelText("Preço (R$)"), { target: { value: "0" } });
    expect(screen.getByText("Grátis no cardápio")).toBeTruthy();
  });

  it("mostra o erro embaixo do campo", async () => {
    render(
      <AddonForm
        {...base}
        action={async () => ({
          ok: false,
          error: { code: "INVALID_PRICE", field: "price", message: "Preço inválido." },
          at: 1,
        })}
      />,
    );
    fireEvent.submit(screen.getByRole("form", { name: "Cadastro do adicional" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Preço inválido.");
  });

  it("chef vê sem poder editar", () => {
    render(<AddonForm {...base} readOnly />);
    expect(screen.getByLabelText("Nome do botão").matches(":disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: "Criar adicional" })).toBeNull();
  });

  it("trocar para outro componente da mesma família mantém a medida; voltar ao vazio também", () => {
    render(
      <AddonForm
        {...base}
        options={{ ...base.options, preps: [{ id: "m", label: "Molho da casa", unit: "g" }] }}
      />,
    );
    const unit = screen.getByLabelText("Medida") as HTMLSelectElement;
    fireEvent.change(screen.getByLabelText("O que vai"), { target: { value: "ITEM:q" } });
    expect(unit.value).toBe("kg");
    fireEvent.change(unit, { target: { value: "g" } });
    fireEvent.change(screen.getByLabelText("O que vai"), { target: { value: "RECIPE:m" } });
    expect(unit.value).toBe("g");
    fireEvent.change(screen.getByLabelText("O que vai"), { target: { value: "" } });
    expect(unit.value).toBe("g");
  });

  it("edição leva id e versão; erro geral em cima; salvo avisa", async () => {
    const results = [
      { ok: false as const, error: { code: "STALE_RECORD" as const, message: "Alguém mudou." }, at: 1 },
      { ok: true as const, data: null, at: 2 },
    ];
    const { container } = render(
      <AddonForm {...base} meta={{ id: "a1", version: 4 }} action={async () => results.shift()!} />,
    );
    expect((container.querySelector("input[name=id]") as HTMLInputElement).value).toBe("a1");
    expect((container.querySelector("input[name=version]") as HTMLInputElement).value).toBe("4");
    const form = screen.getByRole("form", { name: "Cadastro do adicional" });
    await act(async () => {
      fireEvent.submit(form);
    });
    expect((await screen.findAllByText("Alguém mudou.")).length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(await screen.findByText("Alterações salvas.")).toBeTruthy();
  });
});
