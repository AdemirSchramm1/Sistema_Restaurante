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

  it("o aviso de salvo some enquanto o próximo envio salva", async () => {
    let finish: () => void = () => {};
    let calls = 0;
    const action = (): Promise<ActionState> => {
      calls += 1;
      if (calls === 1) return Promise.resolve({ ok: true, data: null, at: 1 });
      return new Promise((resolve) => {
        finish = () => resolve({ ok: true, data: null, at: 2 });
      });
    };
    render(<ActionForm action={action} submitLabel="Salvar" successMessage="Salvo." />);
    await submit("Salvar");
    expect(screen.getByText("Salvo.")).toBeTruthy();
    await submit("Salvar");
    expect(screen.queryByText("Salvo.")).toBeNull();
    await act(async () => finish());
    expect(screen.getByText("Salvo.")).toBeTruthy();
  });

  it("o botão usa o tamanho pedido; o padrão é o pequeno", () => {
    const { unmount } = render(<ActionForm action={succeeding} submitLabel="Salvar" />);
    expect(screen.getByRole("button", { name: "Salvar" }).className).toContain("h-8");
    unmount();
    render(<ActionForm action={succeeding} submitLabel="Pronto" size="lg" variant="success" />);
    const button = screen.getByRole("button", { name: "Pronto" });
    expect(button.className).toContain("h-11");
    expect(button.className).toContain("bg-success");
  });
});
