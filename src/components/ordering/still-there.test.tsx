// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StillThere } from "./still-there";

afterEach(cleanup);

describe("Ainda está aí? (spec 016, US5-2)", () => {
  it("diálogo com Continuar em foco e a contagem anunciada só no começo", () => {
    const onContinue = vi.fn();
    const { rerender } = render(<StillThere secondsLeft={30} onContinue={onContinue} />);
    const dialog = screen.getByRole("alertdialog", { name: "Ainda está aí?" });
    expect(dialog.textContent).toContain("Seu pedido não foi enviado.");
    const button = screen.getByRole("button", { name: "Continuar" });
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole("status").textContent).toBe("O carrinho será limpo em 30 segundos.");
    // A contagem visível muda, mas o anúncio não repete a cada segundo.
    rerender(<StillThere secondsLeft={12} onContinue={onContinue} />);
    expect(screen.getByText("12 s")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("O carrinho será limpo em 30 segundos.");
    fireEvent.click(button);
    expect(onContinue).toHaveBeenCalled();
  });
});
