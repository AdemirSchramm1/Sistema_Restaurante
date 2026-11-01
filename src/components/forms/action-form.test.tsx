// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";
import { ActionForm } from "./action-form";

afterEach(cleanup);

const failing = async (): Promise<ActionState> => ({
  ok: false,
  error: { code: "NAME_IN_USE", field: "name", message: "Já existe um local com este nome." },
  at: 1,
});
const succeeding = async (): Promise<ActionState> => ({ ok: true, data: null, at: 1 });

async function submit(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

describe("ActionForm", () => {
  it("mantém o que foi digitado quando o servidor devolve erro", async () => {
    render(
      <ActionForm action={failing} submitLabel="Criar local">
        <input aria-label="Nome" name="name" defaultValue="" />
      </ActionForm>,
    );
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Câmara de laticínios" } });
    await submit("Criar local");
    expect(await screen.findByText("Já existe um local com este nome.")).toBeTruthy();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Câmara de laticínios");
  });

  it("limpa o formulário depois de salvar", async () => {
    render(
      <ActionForm action={succeeding} submitLabel="Criar local" successMessage="Salvo.">
        <input aria-label="Nome" name="name" defaultValue="" />
      </ActionForm>,
    );
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Bar" } });
    await submit("Criar local");
    expect(await screen.findByText("Salvo.")).toBeTruthy();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("");
  });
});
