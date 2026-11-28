// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";
import type { Photo } from "@/domain/menu/photo";
import { err, ok, type Result } from "@/domain/shared/result";
import { NewProductForm } from "./new-product-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  vi.stubGlobal("URL", { createObjectURL: () => "blob:previa", revokeObjectURL: vi.fn() });
});
afterEach(() => {
  cleanup();
  push.mockClear();
  vi.unstubAllGlobals();
});

/** Produto novo pela tela Cardápio (spec 013, US4). */
const options = { items: [{ id: "i1", label: "Laranja", unit: "kg" as const }], preps: [] };
const sections = [
  { id: "s1", name: "Lanches" },
  { id: "s2", name: "Bebidas" },
];
const created: ActionState = { ok: true, data: { id: "p9" }, at: 1 };
const refused = (code: string, field: string | undefined, message: string): ActionState => ({
  ok: false,
  error: { code: code as never, field, message },
  at: 1,
});
const reduced = new Blob(["reduzida"]);
const photo: Photo = { base: "/fotos/menu/nova", widths: [300] };

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup({
  answer = created,
  check = ok(reduced) as Result<Blob>,
  reduce = async () => check,
}: { answer?: ActionState; check?: Result<Blob>; reduce?: () => Promise<Result<Blob>> } = {}) {
  const sent: Record<string, FormDataEntryValue>[] = [];
  const saving = deferred<ActionState>();
  const sending = deferred<Result<Photo>>();
  const uploads: { recipeId: string; file: Blob }[] = [];
  let progress = (_p: number) => undefined as void;
  render(
    <NewProductForm
      options={options}
      sections={sections}
      action={(_p, form) => {
        sent.push(Object.fromEntries(form));
        return saving.promise;
      }}
      reduce={reduce}
      upload={(input) => {
        uploads.push({ recipeId: input.recipeId!, file: input.file });
        progress = input.onProgress;
        return sending.promise;
      }}
    />,
  );
  return {
    sent,
    uploads,
    progress: (p: number) => act(() => progress(p)),
    saved: () => act(async () => saving.resolve(answer)),
    photoAnswer: (r: Result<Photo>) => act(async () => sending.resolve(r)),
  };
}
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fillAll = () => {
  fill("Nome do produto", "Suco de laranja");
  fill("Item ou preparo da linha 1", "ITEM:i1");
  fill("Quanto vai (linha 1)", "0,3");
  fill("Preço (R$)", "9,00");
  fill("Seção", "s2");
  fill("Descrição", "Feito na hora.");
};
const submit = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Criar produto" }));
  });
const choosePhoto = (label = "Escolher foto") =>
  act(async () => {
    fireEvent.change(screen.getByLabelText(label), {
      target: { files: [new File(["x"], "suco.jpg", { type: "image/jpeg" })] },
    });
  });

describe("produto novo do Cardápio", () => {
  it("mostra nome, o que vai nele, preço, seção, descrição e foto, com campos de toque", () => {
    setup();
    const name = screen.getByLabelText("Nome do produto") as HTMLInputElement;
    expect(name.required).toBe(true);
    expect(name.className).toContain("h-11");
    expect(screen.getByLabelText("Item ou preparo da linha 1").className).toContain("h-11");
    const section = screen.getByLabelText("Seção") as HTMLSelectElement;
    expect([...section.options].map((o) => [o.value, o.text])).toEqual([
      ["s1", "Lanches"],
      ["s2", "Bebidas"],
      ["", "Outros"],
    ]);
    expect(section.value).toBe("");
    expect(screen.getByLabelText("Preço (R$)").getAttribute("inputmode")).toBe("decimal");
    expect(screen.getByText("Faltam 300 caracteres")).toBeTruthy();
    expect(screen.getByLabelText("Escolher foto")).toBeTruthy();
    expect(screen.getByLabelText("Tirar foto com a câmera")).toBeTruthy();
    expect(screen.getByText("Sem foto")).toBeTruthy();
  });

  it("sem foto: cria o produto e volta para a tela Cardápio", async () => {
    const { sent, saved, uploads } = setup();
    fillAll();
    await submit();
    expect(sent).toEqual([
      {
        name: "Suco de laranja",
        "lines.0.component": "ITEM:i1",
        "lines.0.quantity": "0,3",
        "lines.0.unit": "kg",
        salePrice: "9,00",
        sectionId: "s2",
        description: "Feito na hora.",
      },
    ]);
    // Enquanto salva, não dá para enviar de novo.
    expect((screen.getByRole("button", { name: "Criar produto" }) as HTMLButtonElement).disabled).toBe(true);
    expect(push).not.toHaveBeenCalled();
    await saved();
    expect(uploads).toEqual([]);
    expect(push).toHaveBeenCalledWith("/pedidos/cardapio");
  });

  it("com foto: mostra a prévia em 4:3, cria o produto, envia a foto com progresso e volta", async () => {
    const { saved, uploads, progress, photoAnswer } = setup();
    fillAll();
    await choosePhoto();
    const preview = screen.getByRole("img", { name: "Prévia da foto" });
    expect(preview.getAttribute("src")).toBe("blob:previa");
    expect(preview.hasAttribute("data-photo")).toBe(true);
    expect(preview.parentElement!.className).toContain("aspect-[4/3]");
    await submit();
    expect(uploads).toEqual([]);
    await saved();
    expect(uploads).toEqual([{ recipeId: "p9", file: reduced }]);
    progress(60);
    expect(screen.getByRole("progressbar", { name: "Enviando a foto" }).getAttribute("aria-valuenow")).toBe(
      "60",
    );
    expect(push).not.toHaveBeenCalled();
    await photoAnswer(ok(photo));
    expect(push).toHaveBeenCalledWith("/pedidos/cardapio");
  });

  it("enquanto a foto é preparada no aparelho, Criar produto espera (a foto não se perde)", async () => {
    const preparing = deferred<Result<Blob>>();
    setup({ reduce: () => preparing.promise });
    fillAll();
    await choosePhoto();
    const create = screen.getByRole("button", { name: "Criar produto" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    expect(screen.getByRole("status", { name: "Preparando a foto" })).toBeTruthy();
    await act(async () => preparing.resolve(ok(reduced)));
    expect(create.disabled).toBe(false);
    expect(screen.queryByRole("status", { name: "Preparando a foto" })).toBeNull();
    expect(screen.getByRole("img", { name: "Prévia da foto" })).toBeTruthy();
  });

  it("se a foto falhar, o produto já está salvo: abre o produto avisando da foto", async () => {
    const { saved, photoAnswer } = setup();
    fillAll();
    await choosePhoto();
    await submit();
    await saved();
    await photoAnswer(err("PHOTO_STORAGE_FAILED"));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/pedidos/cardapio/p9?foto=falhou");
  });

  it("foto recusada no aparelho: mostra a mensagem e o produto pode ser criado sem ela", async () => {
    const { saved, uploads } = setup({ check: err("PHOTO_TOO_SMALL") });
    await choosePhoto();
    expect(screen.getByRole("alert").textContent).toBe(
      "Essa foto é pequena e vai ficar borrada no cardápio. Use uma foto de pelo menos 600 px.",
    );
    expect(screen.getByText("Sem foto")).toBeTruthy();
    fillAll();
    await submit();
    await saved();
    expect(uploads).toEqual([]);
    expect(push).toHaveBeenCalledWith("/pedidos/cardapio");
  });

  it("Tirar esta foto desiste da foto escolhida", async () => {
    const { saved, uploads } = setup();
    await choosePhoto();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tirar esta foto" }));
    });
    expect(screen.getByText("Sem foto")).toBeTruthy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:previa");
    fillAll();
    await submit();
    await saved();
    expect(uploads).toEqual([]);
  });

  it("escolher outra foto troca a prévia e solta a anterior", async () => {
    setup();
    await choosePhoto();
    await choosePhoto("Trocar foto");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("img", { name: "Prévia da foto" })).toBeTruthy();
  });

  it("desistir na janela de escolha não muda nada", async () => {
    setup();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Escolher foto"), { target: { files: [] } });
    });
    expect(screen.getByText("Sem foto")).toBeTruthy();
  });

  it.each([
    ["RECIPE_DUPLICATE_NAME", "name", "Já existe um produto com esse nome.", "Nome do produto"],
    ["INVALID_PRICE", "salePrice", "Preço inválido.", "Preço (R$)"],
    ["INVALID_DESCRIPTION", "description", "A descrição pode ter até 300 caracteres.", "Descrição"],
    ["INVALID_QUANTITY", "lines.0.quantity", "Informe a quantidade.", "Quanto vai (linha 1)"],
  ])(
    "erro %s aparece no campo, mantém o que foi digitado e não sai da tela",
    async (code, field, message, label) => {
      const { saved } = setup({ answer: refused(code, field, message) });
      fillAll();
      await submit();
      await saved();
      expect(screen.getByRole("alert").textContent).toBe(message);
      expect(screen.getByLabelText(label).getAttribute("aria-invalid")).toBe("true");
      expect((screen.getByLabelText("Nome do produto") as HTMLInputElement).value).toBe("Suco de laranja");
      expect(push).not.toHaveBeenCalled();
      expect((screen.getByRole("button", { name: "Criar produto" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    },
  );

  it("erro que não é de um campo aparece junto do botão", async () => {
    const { saved } = setup({
      answer: refused("FORBIDDEN", undefined, "Você não tem permissão para esta ação."),
    });
    fillAll();
    await submit();
    await saved();
    expect(screen.getByRole("alert").textContent).toBe("Você não tem permissão para esta ação.");
    expect(screen.getByLabelText("Nome do produto").hasAttribute("aria-invalid")).toBe(false);
  });

  it("resposta vazia do servidor (sessão caiu) não navega", async () => {
    const { saved } = setup({ answer: null });
    fillAll();
    await submit();
    await saved();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Não foi possível criar o produto. Tente de novo.");
  });

  it("sem dublês, usa reducePhoto e uploadPhoto de verdade", () => {
    render(<NewProductForm options={options} sections={[]} action={async () => null} />);
    expect(screen.getByRole("form", { name: "Produto novo" })).toBeTruthy();
  });
});
