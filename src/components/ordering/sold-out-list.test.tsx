// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";
import { SoldOutList } from "./sold-out-list";

afterEach(cleanup);

const dishes = [
  { id: "r1", name: "Lasanha", soldOut: true },
  { id: "r2", name: "Risoto", soldOut: false },
];

describe("esgotado hoje na cozinha (spec 009, US5)", () => {
  it("conta os esgotados e oferece o contrário do estado de cada prato", () => {
    render(<SoldOutList dishes={dishes} action={async () => null} />);
    expect(screen.getByText("Esgotado hoje (1)")).toBeTruthy();
    expect(screen.getByText("· esgotado hoje")).toBeTruthy();
    expect(screen.getByRole("form", { name: "Disponível de novo: Lasanha" })).toBeTruthy();
    expect(screen.getByRole("form", { name: "Esgotado hoje: Risoto" })).toBeTruthy();
  });

  it("o botão manda o prato e o novo estado", async () => {
    let sent: Record<string, FormDataEntryValue> = {};
    const action = async (_p: ActionState, f: FormData): Promise<ActionState> => {
      sent = Object.fromEntries(f);
      return { ok: true, data: null, at: 1 };
    };
    render(<SoldOutList dishes={dishes} action={action} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Esgotado hoje" }));
    });
    expect(sent).toEqual({ recipeId: "r2", soldOut: "true" });
  });
});
