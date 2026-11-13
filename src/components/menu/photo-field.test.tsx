// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";
import type { Photo } from "@/domain/menu/photo";
import { err, ok, type Result } from "@/domain/shared/result";
import { PhotoField } from "./photo-field";

/** Foto do produto na tela do Cardápio (spec 013, US1.1 a US1.5). */
const old: Photo = { base: "/fotos/menu/antiga", widths: [300, 600] };
const fresh: Photo = { base: "/fotos/menu/nova", widths: [300, 600, 900] };
const picked = new File(["original"], "prato.jpg", { type: "image/jpeg" });
const reduced = new Blob(["reduzida"]);

beforeEach(() => {
  vi.stubGlobal("URL", { createObjectURL: () => "blob:previa", revokeObjectURL: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Promessa que o teste resolve quando quiser, para ver a tela no meio do envio. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup({ photo = null as Photo | null, check = ok(reduced) as Result<Blob> } = {}) {
  const sending = deferred<Result<Photo>>();
  const calls = {
    reduce: [] as File[],
    upload: [] as { recipeId: string; file: Blob }[],
    progress: (_percent: number) => undefined as void,
    removed: [] as Record<string, FormDataEntryValue>[],
    saved: 0,
  };
  let removal: ActionState = { ok: true, data: null, at: 1 };
  render(
    <PhotoField
      recipeId="r1"
      name="X-Burger"
      photo={photo}
      removeAction={async (_p, form) => {
        calls.removed.push(Object.fromEntries(form));
        return removal;
      }}
      onSaved={() => void (calls.saved += 1)}
      reduce={async (file) => {
        calls.reduce.push(file);
        return check;
      }}
      upload={(input) => {
        calls.upload.push({ recipeId: input.recipeId, file: input.file });
        calls.progress = input.onProgress;
        return sending.promise;
      }}
    />,
  );
  return {
    calls,
    answer: (r: Result<Photo>) => act(async () => sending.resolve(r)),
    failRemoval: (message: string) => {
      removal = { ok: false, error: { code: "NOT_FOUND", message }, at: 1 };
    },
  };
}
const choose = (label: string, file = picked) =>
  act(async () => {
    fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
  });
const click = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });

describe("campo da foto", () => {
  it("sem foto: mostra Sem foto, Escolher foto e Tirar foto com a câmera", () => {
    setup();
    expect(screen.getByText("Sem foto")).toBeTruthy();
    const choose = screen.getByLabelText("Escolher foto") as HTMLInputElement;
    expect(choose.type).toBe("file");
    expect(choose.accept).toBe("image/jpeg,image/png,image/webp");
    expect(choose.hasAttribute("capture")).toBe(false);
    const camera = screen.getByLabelText("Tirar foto com a câmera") as HTMLInputElement;
    expect(camera.getAttribute("capture")).toBe("environment");
    expect(camera.accept).toBe("image/jpeg,image/png,image/webp");
    expect(screen.queryByRole("button", { name: "Tirar foto do cardápio" })).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("com foto: mostra a foto em 4:3 com o nome do produto, Trocar foto e Tirar foto do cardápio", () => {
    setup({ photo: old });
    const img = screen.getByRole("img", { name: "Foto de X-Burger" }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/fotos/menu/antiga/600.webp");
    expect(img.getAttribute("srcset")).toBe(
      "/fotos/menu/antiga/300.webp 300w, /fotos/menu/antiga/600.webp 600w",
    );
    expect(img.hasAttribute("data-photo")).toBe(true);
    expect(img.parentElement!.className).toContain("aspect-[4/3]");
    expect(img.className).toContain("object-cover");
    expect(screen.getByLabelText("Trocar foto")).toBeTruthy();
    expect(screen.queryByLabelText("Escolher foto")).toBeNull();
    expect(screen.getByRole("button", { name: "Tirar foto do cardápio" })).toBeTruthy();
    expect(screen.queryByText("Sem foto")).toBeNull();
  });

  it("escolher a foto: prévia em 4:3, barra de progresso e Foto salva só depois do 200", async () => {
    const { calls, answer } = setup();
    await choose("Escolher foto");
    expect(calls.reduce).toEqual([picked]);
    expect(calls.upload).toEqual([{ recipeId: "r1", file: reduced }]);
    const preview = screen.getByRole("img", { name: "Prévia da foto nova" });
    expect(preview.getAttribute("src")).toBe("blob:previa");
    expect(preview.parentElement!.className).toContain("aspect-[4/3]");
    const bar = screen.getByRole("progressbar", { name: "Enviando a foto" });
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    act(() => calls.progress(40));
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("40%");
    expect(screen.queryByRole("status")).toBeNull();
    // Enquanto envia, não dá para escolher outra.
    expect((screen.getByLabelText("Escolher foto") as HTMLInputElement).disabled).toBe(true);

    await answer(ok(fresh));
    expect(screen.getByRole("status").textContent).toBe("Foto salva");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("img", { name: "Foto de X-Burger" }).getAttribute("src")).toBe(
      "/fotos/menu/nova/600.webp",
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:previa");
    expect(calls.saved).toBe(1);
    expect((screen.getByLabelText("Trocar foto") as HTMLInputElement).disabled).toBe(false);
  });

  it("a câmera segue o mesmo caminho", async () => {
    const { calls, answer } = setup();
    await choose("Tirar foto com a câmera");
    expect(calls.upload).toHaveLength(1);
    await answer(ok(fresh));
    expect(screen.getByRole("status").textContent).toBe("Foto salva");
  });

  it("desistir na janela de escolha (nenhum arquivo) não faz nada", async () => {
    const { calls } = setup();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Escolher foto"), { target: { files: [] } });
    });
    expect(calls.reduce).toEqual([]);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it.each([
    ["PHOTO_TYPE", "Use uma foto JPG, PNG ou WebP."],
    ["PHOTO_TOO_BIG", "A foto pode ter até 10 MB."],
    [
      "PHOTO_TOO_SMALL",
      "Essa foto é pequena e vai ficar borrada no cardápio. Use uma foto de pelo menos 600 px.",
    ],
  ] as const)(
    "arquivo recusado no aparelho (%s): mostra a mensagem e nada é enviado",
    async (code, message) => {
      const { calls } = setup({ photo: old, check: err(code) });
      await choose("Trocar foto");
      expect(screen.getByRole("alert").textContent).toBe(message);
      expect(calls.upload).toEqual([]);
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(screen.getByRole("img", { name: "Foto de X-Burger" }).getAttribute("src")).toBe(
        "/fotos/menu/antiga/600.webp",
      );
    },
  );

  it("erro de envio: mantém a foto antiga, mostra o erro e some com ele na próxima tentativa", async () => {
    const { calls, answer } = setup({ photo: old });
    await choose("Trocar foto");
    await answer(err("PHOTO_STORAGE_FAILED"));
    expect(screen.getByRole("alert").textContent).toBe("Não foi possível enviar a foto. Tente de novo.");
    expect(screen.queryByRole("status")).toBeNull();
    expect(calls.saved).toBe(0);
    expect(screen.getByRole("img", { name: "Foto de X-Burger" }).getAttribute("src")).toBe(
      "/fotos/menu/antiga/600.webp",
    );
    await choose("Trocar foto");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("tirar a foto do cardápio pede confirmação e dá para desistir", async () => {
    const { calls } = setup({ photo: old });
    await click("Tirar foto do cardápio");
    const ask = screen.getByRole("group", { name: "Tirar a foto de X-Burger do cardápio?" });
    expect(calls.removed).toEqual([]);
    await act(async () => {
      fireEvent.click(within(ask).getByRole("button", { name: "Cancelar" }));
    });
    expect(screen.queryByRole("group")).toBeNull();
    expect(calls.removed).toEqual([]);
    expect(screen.getByRole("img", { name: "Foto de X-Burger" })).toBeTruthy();
  });

  it("confirmando, tira a foto e volta a mostrar Sem foto", async () => {
    const { calls } = setup({ photo: old });
    await click("Tirar foto do cardápio");
    await click("Tirar a foto");
    expect(calls.removed).toEqual([{ id: "r1" }]);
    expect(screen.getByText("Sem foto")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Foto tirada do cardápio");
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByLabelText("Escolher foto")).toBeTruthy();
    expect(calls.saved).toBe(1);
  });

  it("se o servidor recusa tirar a foto, mostra o erro e a foto continua", async () => {
    const { failRemoval } = setup({ photo: old });
    failRemoval("Produto não encontrado.");
    await click("Tirar foto do cardápio");
    await click("Tirar a foto");
    expect(screen.getByRole("alert").textContent).toBe("Produto não encontrado.");
    expect(screen.getByRole("img", { name: "Foto de X-Burger" })).toBeTruthy();
  });

  it("depois de enviar uma foto nova, dá para tirar essa foto", async () => {
    const { answer } = setup();
    await choose("Escolher foto");
    await answer(ok(fresh));
    await click("Tirar foto do cardápio");
    await click("Tirar a foto");
    expect(screen.getByText("Sem foto")).toBeTruthy();
  });

  it("sem dublês, usa reducePhoto e uploadPhoto de verdade", () => {
    render(<PhotoField recipeId="r1" name="Suco" photo={null} removeAction={async () => null} />);
    expect(screen.getByLabelText("Escolher foto")).toBeTruthy();
  });
});
