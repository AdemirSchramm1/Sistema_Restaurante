// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Photo } from "@/domain/menu/photo";
import { err, ok, type Result } from "@/domain/shared/result";
import { AppearanceForm } from "./appearance-form";

/** Quadro Aparência na tela Cardápio (spec 016, US1-1, US1-2, US1-6). */
const logo: Photo = { base: "/fotos/menu/logo", widths: [96, 192, 384] };
const fresh: Photo = { base: "/fotos/menu/capa", widths: [600, 1200, 1920] };
const picked = new File(["x"], "capa.jpg", { type: "image/jpeg" });

beforeEach(() => vi.stubGlobal("URL", { createObjectURL: () => "blob:previa", revokeObjectURL: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(check: Result<Blob> = ok(new Blob(["r"]))) {
  const calls = {
    reduce: [] as string[],
    upload: [] as string[],
    removed: [] as Record<string, FormDataEntryValue>[],
  };
  render(
    <AppearanceForm
      appearance={{ logo, cover: null }}
      removeAction={async (_p, form) => {
        calls.removed.push(Object.fromEntries(form));
        return { ok: true, data: null, at: 1 };
      }}
      reduce={async (_file, _tools, shape) => {
        calls.reduce.push(shape!);
        return check;
      }}
      upload={async (input) => {
        calls.upload.push(input.kind!);
        return ok(fresh) as Result<Photo>;
      }}
    />,
  );
  return calls;
}
const pick = (label: string) =>
  act(async () => {
    fireEvent.change(screen.getByLabelText(label), { target: { files: [picked] } });
  });

describe("quadro Aparência", () => {
  it("mostra o logo atual em 1:1 e a capa vazia em 3:1", () => {
    setup();
    const box = screen.getByRole("region", { name: "Aparência" });
    expect(within(box).getByRole("heading", { name: "Aparência" })).toBeTruthy();
    const img = within(box).getByRole("img", { name: "Logo do restaurante" });
    expect(img.parentElement!.className).toContain("aspect-square");
    expect(within(box).getByText("Sem foto de capa").parentElement!.className).toContain("aspect-[3/1]");
  });

  it("escolher a capa mostra o recorte 3:1 antes de salvar; salvar envia com o formato", async () => {
    const calls = setup();
    await pick("Escolher foto de capa");
    expect(calls.reduce).toEqual(["COVER"]);
    const preview = screen.getByRole("img", { name: "Prévia da foto de capa" });
    expect(preview.parentElement!.className).toContain("aspect-[3/1]");
    expect(preview.className).toContain("object-cover");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar foto de capa" })));
    expect(calls.upload).toEqual(["COVER"]);
    expect(screen.getByText("Foto de capa salva")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Foto de capa" }).getAttribute("srcset")).toContain("1920w");
  });

  it("logo pequeno: a mensagem do mínimo, sem enviar", async () => {
    const calls = setup(err("PHOTO_TOO_SMALL", undefined, { kind: "LOGO" }));
    await pick("Trocar logo");
    expect(calls.reduce).toEqual(["LOGO"]);
    expect(screen.getByText("O logo precisa ter pelo menos 200 px no lado menor.")).toBeTruthy();
    expect(calls.upload).toEqual([]);
  });

  it("Tirar pede confirmação e manda o formato", async () => {
    const calls = setup();
    fireEvent.click(screen.getByRole("button", { name: "Tirar logo" }));
    const ask = screen.getByRole("group", { name: "Tirar o logo do cardápio?" });
    await act(async () => fireEvent.click(within(ask).getByRole("button", { name: "Tirar o logo" })));
    expect(calls.removed).toEqual([{ kind: "LOGO" }]);
    expect(screen.getByText("Logo tirado do cardápio")).toBeTruthy();
  });
});
