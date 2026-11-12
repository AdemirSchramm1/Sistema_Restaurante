// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";
import { TableRangeForm } from "./table-range-form";

afterEach(cleanup);

async function create(from: string, to: string) {
  fireEvent.change(screen.getByLabelText("Da mesa"), { target: { value: from } });
  fireEvent.change(screen.getByLabelText("até a mesa"), { target: { value: to } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Criar várias mesas" }));
  });
}
const answer =
  (state: ActionState, seen: Record<string, FormDataEntryValue>[] = []) =>
  async (_p: ActionState, f: FormData): Promise<ActionState> => {
    seen.push(Object.fromEntries(f));
    return state;
  };

describe("criar várias mesas (spec 009)", () => {
  it("diz quantas criou e quais já existiam, e limpa os campos", async () => {
    const seen: Record<string, FormDataEntryValue>[] = [];
    render(
      <TableRangeForm
        action={answer({ ok: true, data: { created: 3, skipped: ["2", "4"] }, at: 1 }, seen)}
      />,
    );
    await create("1", "5");
    expect(seen).toEqual([{ from: "1", to: "5" }]);
    expect(screen.getByRole("status").textContent).toBe("3 mesas criadas. Já existiam: 2, 4.");
    expect((screen.getByLabelText("Da mesa") as HTMLInputElement).value).toBe("");
  });

  it("uma mesa só, no singular e sem lista", async () => {
    render(<TableRangeForm action={answer({ ok: true, data: { created: 1, skipped: [] }, at: 1 })} />);
    await create("7", "7");
    expect(screen.getByRole("status").textContent).toBe("1 mesa criada");
  });

  it("mostra a recusa e mantém o que foi digitado", async () => {
    const refused: ActionState = {
      ok: false,
      error: { code: "VALIDATION", message: "Use números de 1 a 999." },
      at: 1,
    };
    render(<TableRangeForm action={answer(refused)} />);
    await create("10", "2000");
    expect(await screen.findByText("Use números de 1 a 999.")).toBeTruthy();
    expect((screen.getByLabelText("até a mesa") as HTMLInputElement).value).toBe("2000");
  });
});
