// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PrintButton } from "./print-button";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("botão de imprimir", () => {
  it("abre a impressão do navegador", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<PrintButton />);
    fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});
