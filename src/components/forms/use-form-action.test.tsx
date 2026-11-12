// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";
import { useFormAction } from "./use-form-action";

afterEach(cleanup);

function Harness({ action }: { action: (p: ActionState, f: FormData) => Promise<ActionState> }) {
  const { saved, pending, error, formProps } = useFormAction(action);
  return (
    <form {...formProps} aria-label="Teste">
      <input aria-label="Nome" name="name" defaultValue="" />
      <button type="submit">Salvar</button>
      <output aria-label="Situação">{pending ? "salvando" : saved ? "salvo" : (error?.message ?? "")}</output>
    </form>
  );
}

const status = () => screen.getByLabelText("Situação").textContent;
const submit = () => act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar" })));

describe("useFormAction", () => {
  it("'salvo' só depois que o servidor confirma, e não durante o próximo envio", async () => {
    let finish: () => void = () => {};
    let calls = 0;
    const action = (): Promise<ActionState> => {
      calls += 1;
      if (calls === 1) return Promise.resolve({ ok: true, data: null, at: 1 });
      return new Promise((resolve) => {
        finish = () => resolve({ ok: true, data: null, at: 2 });
      });
    };
    render(<Harness action={action} />);
    expect(status()).toBe("");
    await submit();
    expect(status()).toBe("salvo");
    await submit();
    expect(status()).toBe("salvando");
    await act(async () => finish());
    expect(status()).toBe("salvo");
  });

  it("recusa do servidor: erro, nada de 'salvo', e o que foi digitado fica", async () => {
    const action = async (): Promise<ActionState> => ({
      ok: false,
      error: { code: "VALIDATION", message: "Confira o nome." },
      at: 1,
    });
    render(<Harness action={action} />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Molho" } });
    await submit();
    expect(status()).toBe("Confira o nome.");
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Molho");
  });
});
