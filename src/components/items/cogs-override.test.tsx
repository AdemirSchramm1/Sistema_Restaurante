// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";
import { CogsOverride } from "./cogs-override";

afterEach(cleanup);

const base = {
  id: "i1",
  version: 3,
  override: null,
  groupInCogs: true,
  effective: true,
  canEdit: true,
  action: async (): Promise<ActionState> => null,
};
const now = () => screen.getByText(/^Agora:/).textContent;
const choice = () => (screen.getByLabelText("Exceção do item") as HTMLSelectElement).value;

describe("exceção do CMV no item (spec 008)", () => {
  it("sem exceção, segue o grupo e o select começa em 'Seguir o grupo'", () => {
    render(<CogsOverride {...base} />);
    expect(now()).toBe("Agora: sim (segue o grupo: sim)");
    expect(choice()).toBe("group");
  });

  it("com exceção, diz que foi definida no item", () => {
    render(<CogsOverride {...base} override={false} effective={false} />);
    expect(now()).toBe("Agora: não (definido no item)");
    expect(choice()).toBe("false");
  });

  it("quem não pode mudar só vê o valor", () => {
    render(<CogsOverride {...base} canEdit={false} />);
    expect(now()).toBe("Agora: sim (segue o grupo: sim)");
    expect(screen.queryByRole("button", { name: "Salvar exceção" })).toBeNull();
  });

  it("envia o item, a versão e a escolha; mostra a recusa do servidor", async () => {
    let sent: Record<string, FormDataEntryValue> = {};
    const action = async (_p: ActionState, f: FormData): Promise<ActionState> => {
      sent = Object.fromEntries(f);
      return { ok: false, error: { code: "STALE_RECORD", message: "Outra pessoa mudou este item." }, at: 1 };
    };
    render(<CogsOverride {...base} action={action} />);
    fireEvent.change(screen.getByLabelText("Exceção do item"), { target: { value: "true" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar exceção" }));
    });
    expect(sent).toEqual({ id: "i1", version: "3", override: "true" });
    expect(await screen.findByText("Outra pessoa mudou este item.")).toBeTruthy();
  });
});
