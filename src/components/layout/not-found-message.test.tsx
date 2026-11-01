// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotFoundMessage as NotFound } from "./not-found-message";

describe("página não encontrada", () => {
  it("fala português e leva de volta aos itens", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "Registro não encontrado" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar para os itens" }).getAttribute("href")).toBe(
      "/estoque/itens",
    );
  });
});
