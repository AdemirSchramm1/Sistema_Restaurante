// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ActionState } from "@/actions/_session";
import { MoveButtons } from "./move-buttons";

afterEach(cleanup);

const recording = () => {
  const sent: Record<string, FormDataEntryValue>[] = [];
  const action = async (_p: ActionState, f: FormData): Promise<ActionState> => {
    sent.push(Object.fromEntries(f));
    return { ok: true, data: null, at: sent.length };
  };
  return { sent, action };
};

describe("subir e descer no cardápio (spec 013, US2.3 e US3.1)", () => {
  it("cada botão diz o que faz e com quem", () => {
    render(<MoveButtons id="s1" name="Bebidas" canMoveUp canMoveDown action={async () => null} />);
    expect(screen.getByRole("button", { name: "Subir Bebidas" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Descer Bebidas" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Ordem de Bebidas" })).toBeTruthy();
  });

  it("o primeiro não sobe e o último não desce", () => {
    const { rerender } = render(
      <MoveButtons id="s1" name="Entradas" canMoveUp={false} canMoveDown action={async () => null} />,
    );
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Subir Entradas" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Descer Entradas" }).disabled).toBe(false);
    rerender(<MoveButtons id="s1" name="Entradas" canMoveUp canMoveDown={false} action={async () => null} />);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Subir Entradas" }).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Descer Entradas" }).disabled).toBe(true);
  });

  it("envia o id e a direção do botão tocado", async () => {
    const { sent, action } = recording();
    render(<MoveButtons id="s1" name="Bebidas" canMoveUp canMoveDown action={action} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Subir Bebidas" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Descer Bebidas" }));
    });
    expect(sent).toEqual([
      { id: "s1", direction: "up" },
      { id: "s1", direction: "down" },
    ]);
  });

  it("funciona só com o teclado: Tab, Enter e espaço", async () => {
    const { sent, action } = recording();
    const user = userEvent.setup();
    render(<MoveButtons id="s1" name="Bebidas" canMoveUp canMoveDown action={action} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Subir Bebidas" }));
    await user.keyboard("{Enter}");
    await user.tab();
    await user.keyboard(" ");
    expect(sent.map((s) => s.direction)).toEqual(["up", "down"]);
  });

  it("mostra o erro do servidor", async () => {
    const action = async (): Promise<ActionState> => ({
      ok: false,
      error: { code: "NOT_FOUND", message: "Registro não encontrado." },
      at: 1,
    });
    render(<MoveButtons id="s1" name="Bebidas" canMoveUp canMoveDown action={action} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Subir Bebidas" }));
    });
    expect(screen.getByRole("alert").textContent).toBe("Registro não encontrado.");
  });
});
