// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";
import { DeleteSection, NewSectionForm, RenameSectionForm } from "./section-form";

afterEach(cleanup);

type Sent = Record<string, FormDataEntryValue>;
const answering = (answer: (sent: Sent) => ActionState) => {
  const sent: Sent[] = [];
  const action = async (_p: ActionState, f: FormData): Promise<ActionState> => {
    sent.push(Object.fromEntries(f));
    return answer(sent.at(-1)!);
  };
  return { sent, action };
};
const saved: ActionState = { ok: true, data: null, at: 1 };
const taken: ActionState = {
  ok: false,
  error: { code: "NAME_IN_USE", field: "name", message: "Já existe a seção Lanches" },
  at: 1,
};
const submit = async (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });

describe("seção nova (spec 013, US2.1)", () => {
  it("campo com rótulo, até 40 letras, e botão Criar seção", () => {
    render(<NewSectionForm action={async () => null} />);
    const input = screen.getByLabelText<HTMLInputElement>("Nome da seção nova");
    expect(input.maxLength).toBe(40);
    expect(input.required).toBe(true);
    expect(screen.getByRole("form", { name: "Nova seção" })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("envia o nome, avisa que criou e limpa o campo", async () => {
    const { sent, action } = answering(() => saved);
    render(<NewSectionForm action={action} />);
    const input = screen.getByLabelText<HTMLInputElement>("Nome da seção nova");
    fireEvent.change(input, { target: { value: "Bebidas" } });
    await submit("Criar seção");
    expect(sent).toEqual([{ name: "Bebidas" }]);
    expect(screen.getByRole("status").textContent).toBe("Seção criada");
    expect(input.value).toBe("");
  });

  it("nome repetido: a mensagem do servidor fica no campo e o que foi digitado continua", async () => {
    const { action } = answering(() => taken);
    render(<NewSectionForm action={action} />);
    const input = screen.getByLabelText<HTMLInputElement>("Nome da seção nova");
    fireEvent.change(input, { target: { value: "lanches" } });
    await submit("Criar seção");
    expect(screen.getByRole("alert").textContent).toBe("Já existe a seção Lanches");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
    expect(input.value).toBe("lanches");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("erro que não é do campo (sem permissão) aparece do mesmo jeito", async () => {
    const { action } = answering(() => ({
      ok: false,
      error: { code: "FORBIDDEN", message: "Você não tem permissão para esta ação." },
      at: 1,
    }));
    render(<NewSectionForm action={action} />);
    fireEvent.change(screen.getByLabelText("Nome da seção nova"), { target: { value: "X" } });
    await submit("Criar seção");
    expect(screen.getByRole("alert").textContent).toBe("Você não tem permissão para esta ação.");
  });
});

describe("renomear seção (spec 013, US2.2)", () => {
  const section = { id: "s1", name: "Lanches", version: 3 };

  it("manda id, version e o nome novo; Salvo só aparece com a resposta do servidor", async () => {
    let release: (s: ActionState) => void = () => undefined;
    const sent: Sent[] = [];
    const action = (_p: ActionState, f: FormData) => {
      sent.push(Object.fromEntries(f));
      return new Promise<ActionState>((resolve) => (release = resolve));
    };
    render(<RenameSectionForm section={section} action={action} />);
    const input = screen.getByLabelText<HTMLInputElement>("Nome da seção Lanches");
    expect(input.value).toBe("Lanches");
    fireEvent.change(input, { target: { value: "Burgers" } });
    await submit("Salvar nome");
    expect(sent).toEqual([{ id: "s1", version: "3", name: "Burgers" }]);
    expect(screen.queryByRole("status")).toBeNull();
    await act(async () => release(saved));
    expect(screen.getByRole("status").textContent).toBe("Salvo");
  });

  it("recusa do servidor aparece no campo e não mostra Salvo", async () => {
    const { action } = answering(() => taken);
    render(<RenameSectionForm section={section} action={action} />);
    await submit("Salvar nome");
    expect(screen.getByRole("alert").textContent).toBe("Já existe a seção Lanches");
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("apagar seção (spec 013, US2.6)", () => {
  const lanches = { id: "s1", name: "Lanches", productCount: 4 };

  it("pede confirmação dizendo para onde vão os produtos", async () => {
    const { sent, action } = answering(() => saved);
    render(<DeleteSection section={lanches} action={action} />);
    expect(screen.queryByText(/vão para Outros/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Apagar Lanches" }));
    expect(screen.getByRole("group", { name: "Apagar a seção Lanches?" }).textContent).toContain(
      "Os 4 produtos de Lanches vão para Outros",
    );
    expect(sent).toEqual([]);
    await submit("Apagar seção");
    expect(sent).toEqual([{ id: "s1" }]);
  });

  it("Cancelar fecha a confirmação sem apagar", () => {
    const { sent, action } = answering(() => saved);
    render(<DeleteSection section={lanches} action={action} />);
    fireEvent.click(screen.getByRole("button", { name: "Apagar Lanches" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("button", { name: "Apagar Lanches" })).toBeTruthy();
    expect(sent).toEqual([]);
  });

  it("fala no singular e avisa quando a seção está vazia", () => {
    const { rerender } = render(
      <DeleteSection section={{ ...lanches, productCount: 1 }} action={async () => null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Apagar Lanches" }));
    expect(screen.getByRole("group").textContent).toContain("O produto de Lanches vai para Outros");
    rerender(<DeleteSection section={{ ...lanches, productCount: 0 }} action={async () => null} />);
    expect(screen.getByRole("group").textContent).toContain("Lanches não tem produtos");
  });

  it("mostra o erro do servidor", async () => {
    const { action } = answering(() => ({
      ok: false,
      error: { code: "NOT_FOUND", message: "Registro não encontrado." },
      at: 1,
    }));
    render(<DeleteSection section={lanches} action={action} />);
    fireEvent.click(screen.getByRole("button", { name: "Apagar Lanches" }));
    await submit("Apagar seção");
    expect(screen.getByRole("alert").textContent).toBe("Registro não encontrado.");
  });
});
