// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";
import type { MenuProductView } from "@/application/menu/details";
import { ProductMenuForm } from "./product-menu-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

/** Tela do produto no Cardápio (spec 013, US1). */
const product: MenuProductView = {
  id: "p1",
  name: "X-Burger",
  price: "28.00",
  active: true,
  soldOutToday: false,
  photo: { base: "/fotos/menu/abc", widths: [300, 600] },
  description: "Pão, carne e queijo",
  sectionId: "s2",
  version: 7,
  sections: [
    { id: "s1", name: "Entradas" },
    { id: "s2", name: "Lanches" },
  ],
};
type Sent = Record<string, FormDataEntryValue>;
function setup(answer: ActionState = { ok: true, data: null, at: 1 }, over: Partial<MenuProductView> = {}) {
  const sent = { details: [] as Sent[], removed: [] as Sent[] };
  const view = render(
    <ProductMenuForm
      product={{ ...product, ...over }}
      actions={{
        setDetails: async (_p, form) => {
          sent.details.push(Object.fromEntries(form));
          return answer;
        },
        removePhoto: async (_p, form) => {
          sent.removed.push(Object.fromEntries(form));
          return { ok: true, data: null, at: 1 };
        },
      }}
    />,
  );
  return { sent, view };
}
const details = () => screen.getByRole("form", { name: "Descrição e seção" });
const save = () =>
  act(async () => {
    fireEvent.click(within(details()).getByRole("button", { name: "Salvar descrição e seção" }));
  });

describe("tela do produto no Cardápio", () => {
  it("mostra a foto, a descrição e a seção do produto", () => {
    setup();
    expect(screen.getByRole("img", { name: "Foto de X-Burger" })).toBeTruthy();
    const section = within(details()).getByLabelText("Seção") as HTMLSelectElement;
    expect([...section.options].map((o) => [o.value, o.text])).toEqual([
      ["s1", "Entradas"],
      ["s2", "Lanches"],
      ["", "Outros"],
    ]);
    expect(section.value).toBe("s2");
    expect(section.className).toContain("h-11");
    expect((within(details()).getByLabelText("Descrição") as HTMLTextAreaElement).value).toBe(
      "Pão, carne e queijo",
    );
    expect(within(details()).queryByRole("status")).toBeNull();
  });

  it("produto sem seção e sem descrição: Outros escolhido e campo vazio", () => {
    setup(undefined, { sectionId: null, description: null, photo: null });
    expect((within(details()).getByLabelText("Seção") as HTMLSelectElement).value).toBe("");
    expect((within(details()).getByLabelText("Descrição") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText("Sem foto")).toBeTruthy();
  });

  it("salva descrição e seção com o id e a versão, e mostra Salvo só com a resposta", async () => {
    const { sent } = setup();
    fireEvent.change(within(details()).getByLabelText("Seção"), { target: { value: "" } });
    fireEvent.change(within(details()).getByLabelText("Descrição"), { target: { value: "Novo texto" } });
    expect(within(details()).queryByRole("status")).toBeNull();
    await save();
    expect(sent.details).toEqual([{ id: "p1", version: "7", sectionId: "", description: "Novo texto" }]);
    expect(within(details()).getByRole("status").textContent).toBe("Salvo");
  });

  it("depois que a tela busca o produto de novo, o próximo envio leva a versão nova", async () => {
    const { sent, view } = setup();
    view.rerender(
      <ProductMenuForm
        product={{ ...product, version: 8 }}
        actions={{
          setDetails: async (_p, form) => {
            sent.details.push(Object.fromEntries(form));
            return null;
          },
          removePhoto: async () => null,
        }}
      />,
    );
    await save();
    expect(sent.details[0]!.version).toBe("8");
  });

  it("descrição recusada: o erro fica no campo e o texto continua lá", async () => {
    setup({
      ok: false,
      error: {
        code: "INVALID_DESCRIPTION",
        field: "description",
        message: "A descrição pode ter até 300 caracteres.",
      },
      at: 1,
    });
    fireEvent.change(within(details()).getByLabelText("Descrição"), { target: { value: "texto" } });
    await save();
    const field = within(details()).getByLabelText("Descrição") as HTMLTextAreaElement;
    expect(field.value).toBe("texto");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(
      within(details())
        .getAllByRole("alert")
        .map((a) => a.textContent),
    ).toEqual(["A descrição pode ter até 300 caracteres."]);
    expect(within(details()).queryByRole("status")).toBeNull();
  });

  it("outro erro (seção apagada por outra pessoa) aparece junto do botão", async () => {
    setup({
      ok: false,
      error: { code: "NOT_FOUND", field: "sectionId", message: "Registro não encontrado." },
      at: 1,
    });
    await save();
    expect(within(details()).getByRole("alert").textContent).toBe("Registro não encontrado.");
    expect(
      (within(details()).getByLabelText("Descrição") as HTMLTextAreaElement).hasAttribute("aria-invalid"),
    ).toBe(false);
  });

  it("tirar a foto usa a ação de tirar e pede para a tela buscar o produto de novo", async () => {
    const { sent } = setup();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tirar foto do cardápio" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tirar a foto" }));
    });
    expect(sent.removed).toEqual([{ id: "p1" }]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
